import { createSign } from "node:crypto";

const defaultSpreadsheetId = "1PMCKSDqsBMum7o-C7KZ-YwNpJpZa9BPQ7223ag2Q_r";
const defaultSheetName = "Rates";

type FxRateRow = {
  date: string;
  isoDate: string;
  fxUsdThs: number;
  fxThsUsd: number;
};

function json(res: any, status: number, payload: Record<string, unknown>) {
  res.status(status).json(payload);
}

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const requestedDate = String(req.query?.date || req.query?.invoiceDate || "").trim();
  if (!requestedDate) {
    json(res, 400, { error: "Missing date query parameter." });
    return;
  }

  try {
    const rows = await readFxRows();
    const rate = selectRateForDate(rows, requestedDate);
    if (!rate) {
      json(res, 404, {
        error: "No FX rate found.",
        detail: "The Rates sheet did not return any usable Date, TZS_per_USD, USD_per_TZS rows.",
      });
      return;
    }

    json(res, 200, {
      requestedDate: toIsoDate(requestedDate),
      rateDate: rate.isoDate,
      sourceDate: rate.date,
      fxUsdThs: rate.fxUsdThs,
      fxThsUsd: rate.fxThsUsd,
      source: "Google Sheets Rates",
      spreadsheetId: getSpreadsheetId(),
      sheetName: getSheetName(),
    });
  } catch (error) {
    json(res, 500, {
      error: "Could not read FX rates from Google Sheets.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

async function readFxRows() {
  const values = await readSheetValues();
  if (!values.length) return [];

  const headers = values[0].map(normalizeHeader);
  const dateIndex = headers.indexOf("date");
  const tzsPerUsdIndex = headers.indexOf("tzs_per_usd");
  const usdPerTzsIndex = headers.indexOf("usd_per_tzs");

  if (dateIndex < 0 || tzsPerUsdIndex < 0 || usdPerTzsIndex < 0) {
    throw new Error("Rates sheet must contain Date, TZS_per_USD, and USD_per_TZS headers.");
  }

  return values.slice(1)
    .map(row => {
      const date = String(row[dateIndex] || "").trim();
      const isoDate = toIsoDate(date);
      const fxUsdThs = parseLocalizedNumber(row[tzsPerUsdIndex]);
      const fxThsUsd = parseLocalizedNumber(row[usdPerTzsIndex]);
      return { date, isoDate, fxUsdThs, fxThsUsd };
    })
    .filter(row => row.isoDate && Number.isFinite(row.fxUsdThs) && Number.isFinite(row.fxThsUsd));
}

async function readSheetValues(): Promise<string[][]> {
  const accessToken = await getServiceAccountAccessToken();
  if (accessToken) {
    const response = await fetch(googleValuesUrl(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return parseValuesApiResponse(response);
  }

  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (apiKey) {
    const response = await fetch(`${googleValuesUrl()}?key=${encodeURIComponent(apiKey)}`);
    return parseValuesApiResponse(response);
  }

  const response = await fetch(publicCsvUrl());
  if (!response.ok) {
    throw new Error(`Public CSV read failed: ${response.status} ${response.statusText}. Configure GOOGLE_SHEETS_API_KEY or Google service account credentials, or publish/share the sheet.`);
  }
  return parseCsv(await response.text());
}

async function parseValuesApiResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${response.status} ${payload?.error?.message || response.statusText}`);
  }
  return Array.isArray(payload.values) ? payload.values : [];
}

async function getServiceAccountAccessToken() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) return "";

  const now = Math.floor(Date.now() / 1000);
  const assertion = [
    base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" })),
    base64Url(JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })),
  ].join(".");

  const signer = createSign("RSA-SHA256");
  signer.update(assertion);
  const signature = signer.sign(privateKey, "base64url");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${assertion}.${signature}`,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Google service account auth failed: ${payload?.error_description || payload?.error || response.statusText}`);
  }
  return String(payload.access_token || "");
}

function selectRateForDate(rows: FxRateRow[], requestedDate: string) {
  const target = toIsoDate(requestedDate);
  if (!target) return null;

  const sorted = [...rows].sort((left, right) => right.isoDate.localeCompare(left.isoDate));
  return sorted.find(row => row.isoDate <= target) || sorted[0] || null;
}

function googleValuesUrl() {
  const spreadsheetId = encodeURIComponent(getSpreadsheetId());
  const range = encodeURIComponent(`${getSheetName()}!A:C`);
  return `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
}

function publicCsvUrl() {
  const spreadsheetId = encodeURIComponent(getSpreadsheetId());
  const sheetName = encodeURIComponent(getSheetName());
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${sheetName}`;
}

function getSpreadsheetId() {
  return process.env.FX_RATES_SPREADSHEET_ID || defaultSpreadsheetId;
}

function getSheetName() {
  return process.env.FX_RATES_SHEET_NAME || defaultSheetName;
}

function normalizeHeader(value: string) {
  return String(value || "").trim().toLowerCase();
}

function parseLocalizedNumber(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number(normalized);
}

function toIsoDate(value: string) {
  const trimmed = String(value || "").trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const europeanMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (europeanMatch) {
    const [, day, month, year] = europeanMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
  return "";
}

function base64Url(input: string) {
  return Buffer.from(input).toString("base64url");
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
