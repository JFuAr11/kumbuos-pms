const defaultFallbackModels = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
];

type GeminiHttpError = Error & {
  status?: number;
  detail?: string;
};

const safeHelpResponse = {
  reply:
    "I can help only with Accountancy: read supplier invoices and proof-of-payment documents, prepare revenue, expense, asset, or liability entries, and propose updates or deletions to existing accounting entries. I will always ask for confirmation before posting, editing, or deleting anything.",
  extraction: {
    action: "none",
    targetEntryId: "",
    targetReference: "",
    type: "Unknown",
    confidence: 1,
    date: "",
    category: "",
    subcategories: [],
    subcategoryBreakdown: [],
    counterparty: "",
    description: "",
    amount: 0,
    currency: "USD",
    amountUsd: 0,
    amountThs: 0,
    fxUsdThs: 2600,
    fxThsUsd: 1 / 2600,
    reservationId: "",
    customerInvoiceId: "",
    supplierInvoiceId: "",
    documentType: "Other",
    paymentMethod: "",
    reference: "",
    taxAmount: 0,
    questions: [],
  },
};

const safeUnableToExtractResponse = {
  reply:
    "I could not extract a reliable accounting entry from that request. Please attach the invoice or proof of payment, or specify the date, counterparty, amount, currency, category, subcategories, traceability IDs, and whether it is revenue, expense, asset, or liability.",
  extraction: {
    action: "none",
    targetEntryId: "",
    targetReference: "",
    type: "Unknown",
    confidence: 0,
    date: "",
    category: "",
    subcategories: [],
    subcategoryBreakdown: [],
    counterparty: "",
    description: "",
    amount: 0,
    currency: "USD",
    amountUsd: 0,
    amountThs: 0,
    fxUsdThs: 2600,
    fxThsUsd: 1 / 2600,
    reservationId: "",
    customerInvoiceId: "",
    supplierInvoiceId: "",
    documentType: "Other",
    paymentMethod: "",
    reference: "",
    taxAmount: 0,
    questions: [
    "Please provide date, counterparty, amount, currency, category, subcategories if available, and whether it is revenue, expense, asset, or liability.",
    ],
  },
};

const modelCooldownUntil = new Map<string, number>();
const permanentlySkippedModels = new Set<string>();
const quotaCooldownMs = 15 * 60 * 1000;
const retryableCooldownMs = 2 * 60 * 1000;

const systemInstruction = `
You are KumbuOS GenAI Assistant for the Accountancy module of a luxury hospitality PMS.

Your job:
1. Read supplier invoices and customer proof-of-payment documents.
2. Interpret Accountancy-only requests to create, update, or delete ledger entries.
3. Decide whether the accounting entry is Revenue, Expense, Asset, or Liability.
4. Extract the exact fields required by the KumbuOS Accountancy ledger, including category and one or many subcategories.
5. Never post, edit, or delete directly. Return a reviewable JSON candidate so the user can confirm or edit it.

Hard guardrails:
- You are strictly limited to the Accountancy module.
- Never propose or describe actions that modify Reservations, Supply Requests, Check-in, Admin Platform, Owner Console, companies, properties, users, permissions, rates, rooms, or clients.
- Only work with the active property and the provided active-property ledger entries.
- For update/delete requests, identify an existing ledger entry from the provided entries. If the target is unclear, return action "none", type "Unknown", and questions.

Classify:
- Proof of payment, bank transfer proof, customer receipt, OTA payout, reservation payment: Revenue.
- Supplier invoice, purchase receipt, bill, vendor statement, operating cost: Expense.
- Cash, bank deposits, receivables, inventory, equipment, vehicles, fixed assets, prepayments: Asset.
- Supplier balances payable, customer deposits, taxes payable, loans, accrued costs: Liability.
- If the document is ambiguous, return type "Unknown" and list questions.

Category and subcategory guidance:
- Revenue categories include Accommodation Revenue, Food & Beverage Revenue, Activities Revenue, OTA Payments, Direct Client Payments, Agency Payments, Tour Operator Payments.
- Expense categories include Food Supply, Beverage Supply, Housekeeping, Maintenance, Fuel, Payroll, Utilities, Marketing, Bank Fees, Taxes.
- Asset categories include Cash and Bank, Accounts Receivable, Inventory, Fixed Assets, Prepayments.
- Liability categories include Accounts Payable, Customer Deposits, Taxes Payable, Loans, Accruals.
- Always identify subcategories when visible. For food invoices, use ingredients or line items as subcategories, for example Carrot, Chicken, Leek.
- A category can have one or many subcategories. If subcategories are not visible or cannot be inferred safely, return an empty subcategories array and ask the user to add them.
- When line items or ingredients have values, return subcategoryBreakdown with one row per subcategory and its amount in the source invoice currency.
- The sum of subcategoryBreakdown[].amount must equal the invoice/category total amount. If the document has multiple subcategory lines, allocate the full invoice total across them exactly.
- For Revenue linked to a booking, extract the reservation ID when visible, for example RR_000001, and extract the customer invoice ID when visible.
- For Expense linked to a supplier bill, extract the supplier invoice ID when visible.

Currency and FX rules:
- Source invoices and proof-of-payment documents can be in USD or Tanzanian shillings. In KumbuOS use "THS" for Tanzanian shillings; if the document says TZS, normalize it to THS.
- Always identify the source document currency when visible and return it in currency.
- Always return amountUsd and amountThs regardless of the source currency.
- Always return FX_USD_THS as fxUsdThs and FX_THS_USD as fxThsUsd.
- Use the invoice issue date for the exchange rate when the document provides enough information. If you cannot verify the exact historical exchange rate from the document, use 2600 for fxUsdThs and 0.0003846154 for fxThsUsd, and ask the user to confirm or adjust the FX fields before posting.

Return strict JSON only:
{
  "reply": "short human-readable summary for the finance user",
  "extraction": {
    "action": "create|update|delete|none",
    "targetEntryId": "existing ledger id for update/delete or empty",
    "targetReference": "existing ledger reference if useful or empty",
    "type": "Revenue|Expense|Asset|Liability|Unknown",
    "confidence": 0.0,
    "date": "YYYY-MM-DD or empty",
    "category": "short ledger category",
    "subcategories": ["one or more concrete subcategories when visible"],
    "subcategoryBreakdown": [
      { "name": "subcategory name", "amount": 0, "amountUsd": 0, "amountThs": 0 }
    ],
    "counterparty": "customer, agency, OTA, supplier, or vendor name",
    "description": "one-line accounting description",
    "amount": 0,
    "currency": "USD|THS",
    "amountUsd": 0,
    "amountThs": 0,
    "fxUsdThs": 2600,
    "fxThsUsd": 0.0003846154,
    "reservationId": "reservation or booking ID for revenue when visible, otherwise empty",
    "customerInvoiceId": "customer/reservation invoice ID for revenue when visible, otherwise empty",
    "supplierInvoiceId": "supplier invoice ID for expenses when visible, otherwise empty",
    "documentType": "Supplier Invoice|Proof of Payment|Reservation Payment|Other",
    "paymentMethod": "bank transfer, card, cash, mobile money, or empty",
    "reference": "invoice number, POP reference, reservation ID, transaction ID, or empty",
    "taxAmount": 0,
    "questions": []
  }
}

Rules:
- Use numbers only for amount and taxAmount.
- Use numbers only for amountUsd, amountThs, fxUsdThs, fxThsUsd, and subcategoryBreakdown amounts.
- Validate internally that the subcategoryBreakdown source-currency amount sum equals amount. If it does not, correct the allocation before returning JSON.
- For normal invoice or proof-of-payment extraction, action is "create".
- For a user request to modify/correct/change an existing entry, action is "update".
- For a user request to remove/delete/cancel an existing ledger entry, action is "delete".
- For update/delete, only choose a targetEntryId when the existing entry is clearly identifiable from the active-property ledger list.
- Use the document's currency when visible; default to the active property currency.
- Do not invent invoice numbers, dates, tax, or payment references.
- If multiple line items exist, use the accounting category for the group and put each meaningful line item into subcategories.
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

function getErrorStatus(error: unknown) {
  return typeof (error as GeminiHttpError)?.status === "number"
    ? (error as GeminiHttpError).status
    : null;
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
  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }
    throw new Error("Gemini returned a non-JSON response.");
  }
}

const defaultFxUsdThs = 2600;
const defaultFxThsUsd = 1 / defaultFxUsdThs;

function normalizeCurrency(currency: string) {
  const value = String(currency || "USD").trim().toUpperCase();
  if (value === "TZS") return "THS";
  return value === "THS" ? "THS" : "USD";
}

function roundMoney(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
}

function buildDualCurrencyAmounts(amount: number, currency: string, fxUsdThs?: number, fxThsUsd?: number) {
  const normalizedCurrency = normalizeCurrency(currency);
  const safeFxUsdThs = Number(fxUsdThs || defaultFxUsdThs);
  const safeFxThsUsd = Number(fxThsUsd || (safeFxUsdThs ? 1 / safeFxUsdThs : defaultFxThsUsd));

  if (normalizedCurrency === "THS") {
    return {
      amountUsd: roundMoney(Number(amount || 0) * safeFxThsUsd),
      amountThs: roundMoney(Number(amount || 0), 0),
      fxUsdThs: safeFxUsdThs,
      fxThsUsd: safeFxThsUsd,
    };
  }

  return {
    amountUsd: roundMoney(Number(amount || 0)),
    amountThs: roundMoney(Number(amount || 0) * safeFxUsdThs, 0),
    fxUsdThs: safeFxUsdThs,
    fxThsUsd: safeFxThsUsd,
  };
}

function normalizeSubcategoryBreakdown(extraction: any, currency: string, fxUsdThs: number, fxThsUsd: number) {
  const rows = Array.isArray(extraction.subcategoryBreakdown)
    ? extraction.subcategoryBreakdown
    : [];

  if (rows.length) {
    return rows
      .map((item: any) => {
        const amount = Number.isFinite(Number(item.amount)) ? Number(item.amount) : 0;
        const fx = buildDualCurrencyAmounts(amount, currency, fxUsdThs, fxThsUsd);
        return {
          name: String(item.name || "").trim(),
          amount,
          amountUsd: Number.isFinite(Number(item.amountUsd)) ? Number(item.amountUsd) : fx.amountUsd,
          amountThs: Number.isFinite(Number(item.amountThs)) ? Number(item.amountThs) : fx.amountThs,
        };
      })
      .filter((item: any) => item.name);
  }

  const names = Array.isArray(extraction.subcategories)
    ? extraction.subcategories.map(String).map((item: string) => item.trim()).filter(Boolean)
    : [];

  if (!names.length) return [];

  const splitAmount = Number(extraction.amount || 0) / names.length;
  return names.map((name: string) => {
    const fx = buildDualCurrencyAmounts(splitAmount, currency, fxUsdThs, fxThsUsd);
    return {
      name,
      amount: splitAmount,
      amountUsd: fx.amountUsd,
      amountThs: fx.amountThs,
    };
  });
}

function normalizeAssistantPayload(payload: any, propertyCurrency = "USD") {
  const extraction = payload?.extraction || {};
  const action = ["create", "update", "delete", "none"].includes(extraction.action)
    ? extraction.action
    : "none";
  const type = ["Revenue", "Expense", "Asset", "Liability", "Unknown"].includes(extraction.type)
    ? extraction.type
    : "Unknown";
  const documentType = ["Supplier Invoice", "Proof of Payment", "Reservation Payment", "Other"].includes(extraction.documentType)
    ? extraction.documentType
    : "Other";
  const currency = normalizeCurrency(extraction.currency || propertyCurrency || "USD");
  const amount = Number.isFinite(Number(extraction.amount)) ? Number(extraction.amount) : 0;
  const fxSeed = buildDualCurrencyAmounts(amount, currency, extraction.fxUsdThs, extraction.fxThsUsd);
  const subcategoryBreakdown = normalizeSubcategoryBreakdown(extraction, currency, fxSeed.fxUsdThs, fxSeed.fxThsUsd);

  return {
    reply: typeof payload?.reply === "string" && payload.reply.trim()
      ? payload.reply.trim()
      : safeUnableToExtractResponse.reply,
    extraction: {
      action,
      targetEntryId: String(extraction.targetEntryId || ""),
      targetReference: String(extraction.targetReference || ""),
      type,
      confidence: Number.isFinite(Number(extraction.confidence)) ? Number(extraction.confidence) : 0,
      date: String(extraction.date || ""),
      category: String(extraction.category || ""),
      subcategories: subcategoryBreakdown.length
        ? subcategoryBreakdown.map((item: any) => item.name)
        : Array.isArray(extraction.subcategories)
          ? extraction.subcategories.map(String).map((item: string) => item.trim()).filter(Boolean)
          : [],
      subcategoryBreakdown,
      counterparty: String(extraction.counterparty || ""),
      description: String(extraction.description || ""),
      amount,
      currency,
      amountUsd: Number.isFinite(Number(extraction.amountUsd)) ? Number(extraction.amountUsd) : fxSeed.amountUsd,
      amountThs: Number.isFinite(Number(extraction.amountThs)) ? Number(extraction.amountThs) : fxSeed.amountThs,
      fxUsdThs: fxSeed.fxUsdThs,
      fxThsUsd: fxSeed.fxThsUsd,
      reservationId: String(extraction.reservationId || ""),
      customerInvoiceId: String(extraction.customerInvoiceId || ""),
      supplierInvoiceId: String(extraction.supplierInvoiceId || ""),
      documentType,
      paymentMethod: String(extraction.paymentMethod || ""),
      reference: String(extraction.reference || ""),
      taxAmount: Number.isFinite(Number(extraction.taxAmount)) ? Number(extraction.taxAmount) : 0,
      questions: Array.isArray(extraction.questions) ? extraction.questions.map(String) : [],
    },
  };
}

function isBasicHelpRequest(message: string) {
  const normalized = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s?!.]/g, "")
    .trim()
    .toLowerCase();
  if (!normalized) return false;
  return /^(hola|hello|hi|hey|buenas|que puedes hacer|what can you do|help|ayuda)[\s?!.]*$/i.test(normalized);
}

async function callGemini(model: string, body: any, apiKey: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`${response.status} ${payload?.error?.message || response.statusText}`) as GeminiHttpError;
    error.status = response.status;
    error.detail = payload?.error?.message || response.statusText;
    throw error;
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

  if (!files.length && isBasicHelpRequest(message)) {
    res.status(200).json({ ...safeHelpResponse, model: "local-accountancy-guardrail" });
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

Attached source documents:
${files.map((file: any, index: number) => `${index + 1}. ${file.name || "Unnamed document"} (${file.mimeType || "application/octet-stream"})`).join("\n") || "None"}
`.trim(),
    },
    ...files.map((file: any) => ({
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

  if (!models.length) {
    res.status(429).json({
      error: "All configured Gemini fallback models are temporarily cooling down.",
      detail: "Please retry in a few minutes or review GEMINI_FALLBACK_MODELS.",
    });
    return;
  }

  for (const model of models) {
    try {
      const geminiResponse = await callGemini(model, requestBody, apiKey);
      const text = extractText(geminiResponse);
      const parsed = parseJson(text);
      res.status(200).json({ ...normalizeAssistantPayload(parsed, property.currency || "USD"), model });
      return;
    } catch (error) {
      lastError = error;
      markModelUnavailable(model, error);
      const status = getErrorStatus(error);
      if (status === 400 || status === 401 || status === 403) {
        res.status(status).json({
          error: "Gemini rejected the request.",
          detail: getErrorMessage(error),
        });
        return;
      }
      if (/non-json response|unexpected end of json input/i.test(getErrorMessage(error))) {
        continue;
      }
      if (!isRetryableError(error) && !isUnsupportedModelError(error)) break;
    }
  }

  if (isQuotaError(lastError)) {
    res.status(429).json({
      error: "No Gemini fallback model is currently available.",
      detail: getErrorMessage(lastError),
    });
    return;
  }

  res.status(200).json({
    ...safeUnableToExtractResponse,
    detail: getErrorMessage(lastError),
  });
}

