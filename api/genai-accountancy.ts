const defaultFallbackModels = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
  "gemma-3-27b-it",
  "gemma-3-12b-it",
  "gemma-3-4b-it",
  "gemma-3-1b-it",
];

const modelCooldownUntil = new Map<string, number>();
const permanentlySkippedModels = new Set<string>();
const quotaCooldownMs = 15 * 60 * 1000;
const retryableCooldownMs = 2 * 60 * 1000;

const systemInstruction = `
You are KumbuOS GenAI Assistant for the Accountancy module of a luxury hospitality PMS.

Your job:
1. Read supplier invoices and customer proof-of-payment documents.
2. Interpret Accountancy-only requests to create, update, or delete ledger entries.
3. Decide whether the accounting entry is Revenue or Expense.
4. Extract the exact fields required by the KumbuOS Accountancy ledger.
5. Never post, edit, or delete directly. Return a reviewable JSON candidate so the user can confirm or edit it.

Hard guardrails:
- You are strictly limited to the Accountancy module.
- Never propose or describe actions that modify Reservations, Supply Requests, Check-in, Admin Platform, Owner Console, companies, properties, users, permissions, rates, rooms, or clients.
- Only work with the active property and the provided active-property ledger entries.
- For update/delete requests, identify an existing ledger entry from the provided entries. If the target is unclear, return action "none", type "Unknown", and questions.

Classify:
- Proof of payment, bank transfer proof, customer receipt, OTA payout, reservation payment: Revenue.
- Supplier invoice, purchase receipt, bill, vendor statement, operating cost: Expense.
- If the document is ambiguous, return type "Unknown" and list questions.

Return strict JSON only:
{
  "reply": "short human-readable summary for the finance user",
  "extraction": {
    "action": "create|update|delete|none",
    "targetEntryId": "existing ledger id for update/delete or empty",
    "targetReference": "existing ledger reference if useful or empty",
    "type": "Revenue|Expense|Unknown",
    "confidence": 0.0,
    "date": "YYYY-MM-DD or empty",
    "category": "short ledger category",
    "counterparty": "customer, agency, OTA, supplier, or vendor name",
    "description": "one-line accounting description",
    "amount": 0,
    "currency": "USD",
    "documentType": "Supplier Invoice|Proof of Payment|Reservation Payment|Other",
    "paymentMethod": "bank transfer, card, cash, mobile money, or empty",
    "reference": "invoice number, POP reference, reservation ID, transaction ID, or empty",
    "taxAmount": 0,
    "questions": []
  }
}

Rules:
- Use numbers only for amount and taxAmount.
- For normal invoice or proof-of-payment extraction, action is "create".
- For a user request to modify/correct/change an existing entry, action is "update".
- For a user request to remove/delete/cancel an existing ledger entry, action is "delete".
- For update/delete, only choose a targetEntryId when the existing entry is clearly identifiable from the active-property ledger list.
- Use the document's currency when visible; default to the active property currency.
- Do not invent invoice numbers, dates, tax, or payment references.
- If multiple line items exist, summarize them into the accounting category and description.
- Use hotel finance language, concise and operational.
`.trim();

function readModelList() {
  const configured = process.env.GEMINI_FALLBACK_MODELS;
  const models = configured?.trim()
    ? configured.split(",").map(model => model.trim()).filter(Boolean)
    : defaultFallbackModels;
  return [...new Set(models)];
}

function getReadyModels() {
  const now = Date.now();
  return readModelList().filter(model => {
    if (permanentlySkippedModels.has(model)) return false;
    return (modelCooldownUntil.get(model) || 0) <= now;
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isUnsupportedModelError(error: unknown) {
  return /404|not found|unknown model|invalid model|unsupported|not available/i.test(getErrorMessage(error));
}

function isQuotaError(error: unknown) {
  return /429|quota|resource_exhausted|rate limit|free_tier|limit/i.test(getErrorMessage(error));
}

function isRetryableError(error: unknown) {
  return isQuotaError(error) || /500|503|timeout|deadline|overloaded|temporarily unavailable|internal/i.test(getErrorMessage(error));
}

function markModelUnavailable(model: string, error: unknown) {
  if (isUnsupportedModelError(error)) {
    permanentlySkippedModels.add(model);
    return;
  }

  if (!isRetryableError(error)) return;
  modelCooldownUntil.set(model, Date.now() + (isQuotaError(error) ? quotaCooldownMs : retryableCooldownMs));
}

function extractText(response: any) {
  return response?.candidates?.[0]?.content?.parts
    ?.map((part: any) => part.text || "")
    .join("")
    .trim() || "";
}

function parseJson(raw: string) {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(cleaned);
}

async function callGemini(model: string, body: any, apiKey: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${response.status} ${payload?.error?.message || response.statusText}`);
  }
  return payload;
}

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Missing GEMINI_API_KEY environment variable." });
    return;
  }

  const requestPayload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const { message = "", files = [], property = {}, accountancyEntries = [] } = requestPayload;
  if (!message.trim() && !files.length) {
    res.status(400).json({ error: "Message or files are required." });
    return;
  }

  const parts = [
    {
      text: `
Active property:
- ID: ${property.id || ""}
- Name: ${property.name || ""}
- Legal name: ${property.legalName || ""}
- Finance email: ${property.invoiceEmail || ""}
- Default currency: ${property.currency || "USD"}

User request:
${message || "Please read the attached document and extract the accounting entry."}

Existing active-property Accountancy ledger entries available for update/delete:
${JSON.stringify(accountancyEntries).slice(0, 12000)}
`.trim(),
    },
    ...files.slice(0, 4).map((file: any) => ({
      inlineData: {
        mimeType: file.mimeType || "application/octet-stream",
        data: file.data,
      },
    })),
  ];

  const requestBody = {
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    contents: [
      {
        role: "user",
        parts,
      },
    ],
    generationConfig: {
      temperature: 0.08,
      topP: 0.8,
      responseMimeType: "application/json",
    },
  };

  const models = getReadyModels();
  let lastError: unknown = null;

  for (const model of models) {
    try {
      const geminiResponse = await callGemini(model, requestBody, apiKey);
      const text = extractText(geminiResponse);
      const parsed = parseJson(text);
      res.status(200).json({ ...parsed, model });
      return;
    } catch (error) {
      lastError = error;
      markModelUnavailable(model, error);
      if (!isRetryableError(error) && !isUnsupportedModelError(error)) break;
    }
  }

  res.status(502).json({
    error: "No Gemini fallback model is currently available.",
    detail: getErrorMessage(lastError),
  });
}
