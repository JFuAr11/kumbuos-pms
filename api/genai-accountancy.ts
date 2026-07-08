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
    "I can help only with Accountancy: read supplier invoices and proof-of-payment documents, import current financial statements as a reviewed financial baseline, prepare revenue, expense, asset, or liability entries, and propose updates or deletions to existing accounting entries. I will always ask for confirmation before posting, editing, or deleting anything.",
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
    ifrsTreatment: "",
    capitalizationCandidate: false,
    assetUsefulLifeMonths: 0,
    depreciationMethod: "",
    ifrsNotes: "",
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
    ifrsTreatment: "",
    capitalizationCandidate: false,
    assetUsefulLifeMonths: 0,
    depreciationMethod: "",
    ifrsNotes: "",
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
5. Extract invoice line item details when visible: item name, quantity, unit, unit price, and line total.
6. Import current financial statements when the user is setting a financial baseline/opening position.
7. Apply IFRS-oriented classification support for hospitality accounting, while still returning a reviewable candidate for the user.
8. Never post, edit, or delete directly. Return a reviewable JSON candidate so the user can confirm or edit it.

Hard guardrails:
- You are strictly limited to the Accountancy module.
- Never propose or describe actions that modify Reservations, Supply Requests, Check-in, Admin Platform, Owner Console, companies, properties, users, permissions, rates, rooms, or clients.
- Only work with the active property and the provided active-property ledger entries.
- For update/delete requests, identify an existing ledger entry from the provided entries. If the target is unclear, return action "none", type "Unknown", and questions.
- For financial baseline/opening-position requests, read the provided P&L and Balance statements and return a batch of entries in extraction.entries. Each returned entry must be one confirmed-source candidate that the user can review before posting.
- In Document Chat, whenever at least one source document is attached, do not ask whether it is an invoice, proforma invoice, quote, quotation, purchase order, receipt, bill, or proof of payment. Treat it as a finance source document and always return a reviewable action "create" proposal if any date, counterparty, amount, item, or currency can be extracted.
- If an attached supplier document may correspond to an asset purchase, fixed asset, furniture, equipment, construction, renovation, or property improvement, return a multi-section proposal in extraction.entries with at least:
  1. one Expense entry so the invoice can feed Profit & Loss, and
  2. one Asset entry so the same source can feed Balance.
  The user will review, remove, edit, or confirm the exact destinations before posting.

Classify:
- Proof of payment, bank transfer proof, customer receipt, OTA payout, reservation payment: Revenue.
- Supplier invoice, purchase receipt, bill, vendor statement, operating cost: Expense.
- Cash, bank deposits, receivables, inventory, equipment, vehicles, fixed assets, prepayments: Asset.
- Supplier balances payable, customer deposits, taxes payable, loans, accrued costs: Liability.
- If an attached source document is ambiguous but has extractable financial content, still return the best reviewable create proposal and put uncertainties in ifrsNotes/questions. Do not return action "none" solely because the source says quotation, proforma, quote, or proposal.
- IFRS operating logic: ordinary consumables and repairs that maintain an asset are usually Expense; materials/equipment that create future economic benefits or improve a property beyond normal maintenance are Asset/PPE capitalization candidates; goods held for later consumption/resale are Inventory assets; customer payments before service delivery can be Liability/Customer Deposits until earned; depreciation/amortization is an Expense paired with a contra-asset/asset adjustment managed after user confirmation.
- If an attached supplier document mixes operating expense items and capitalizable PPE/improvement items, choose the dominant treatment for the single proposal, mark capitalizationCandidate when relevant, and explain the uncertainty in ifrsNotes/questions. Never leave the user without a proposal in Document Chat.
- If an attached supplier document mixes operating expense items and capitalizable PPE/improvement items, prefer extraction.entries with separate reviewable Expense and Asset lines. Do not silently choose only one destination when an asset treatment is plausible.
- Proforma invoices, quotes, quotations, purchase orders, or proposals for goods/services are handled as supplier invoice proposals for review. Use documentType "Supplier Invoice"; set confidence lower if needed; explain the source wording in ifrsNotes; the user will confirm or edit before posting.
- For a financial baseline import, split statement lines into separate ledger candidates:
  - P&L revenue lines -> Revenue.
  - P&L expense lines -> Expense.
  - Balance asset lines -> Asset.
  - Balance liability lines -> Liability.
  - Do not create P&L total, Balance total, net profit, retained earnings, or subtotal lines as separate entries unless the statement only provides totals and no detail.
  - Use category names exactly enough to preserve traceability, and use subcategories for statement line details when available.

Category and subcategory guidance:
- Revenue categories include Accommodation Revenue, Food & Beverage Revenue, Activities Revenue, OTA Payments, Direct Client Payments, Agency Payments, Tour Operator Payments.
- Expense categories include Food Supply, Beverage Supply, Housekeeping, Maintenance, Fuel, Payroll, Utilities, Marketing, Bank Fees, Taxes.
- Asset categories include Cash and Bank, Accounts Receivable, Inventory, Fixed Assets, Prepayments.
- Liability categories include Accounts Payable, Customer Deposits, Taxes Payable, Loans, Accruals.
- Always identify subcategories when visible. For food invoices, use ingredients or line items as subcategories, for example Carrot, Chicken, Leek.
- A category can have one or many subcategories. If subcategories are not visible or cannot be inferred safely, return an empty subcategories array and ask the user to add them.
- When line items or ingredients have values, return subcategoryBreakdown with one row per subcategory and its amount in the source invoice currency.
- For every visible line item, include quantity, unit, unitPrice, and lineTotal when available. lineTotal should equal quantity * unitPrice when both are visible. These fields are informational and must be saved for audit traceability, but the ledger amount used for accounting is the invoice total amount.
- subcategoryBreakdown[].amount is the line allocation in the source invoice currency. The sum of subcategoryBreakdown[].amount must equal the invoice/category total amount. If the document has multiple subcategory lines, allocate the full invoice total across them exactly.
- For Revenue linked to a booking, extract the reservation ID when visible, for example RR_000001, and extract the customer invoice ID when visible.
- For Expense linked to a supplier bill, extract the supplier invoice ID when visible.

Currency and FX rules:
- Source invoices and proof-of-payment documents can be in USD or Tanzanian shillings. In KumbuOS use "TZS" for Tanzanian shillings; if legacy data says THS, normalize it to TZS.
- Always identify the source document currency when visible and return it in currency.
- Always return amountUsd and amountThs regardless of the source currency.
- Always return FX_USD_TZS as fxUsdThs and FX_TZS_USD as fxThsUsd.
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
      { "name": "subcategory name", "quantity": 0, "unit": "unit label or empty", "unitPrice": 0, "lineTotal": 0, "amount": 0, "amountUsd": 0, "amountThs": 0 }
    ],
    "counterparty": "customer, agency, OTA, supplier, or vendor name",
    "description": "one-line accounting description",
    "amount": 0,
    "currency": "USD|TZS",
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
    "ifrsTreatment": "Operating Expense|Inventory|PPE Capitalization|PPE Depreciation|Intangible Amortization|Revenue Recognition|Liability Recognition|Prepayment|Manual Adjustment|empty",
    "capitalizationCandidate": false,
    "assetUsefulLifeMonths": 0,
    "depreciationMethod": "Straight-line|Manual|empty",
    "ifrsNotes": "short explanation of IFRS reasoning or empty",
    "questions": [],
    "entries": [
      {
        "action": "create",
        "type": "Revenue|Expense|Asset|Liability",
        "date": "YYYY-MM-DD",
        "category": "statement line category",
        "subcategories": ["optional details"],
        "subcategoryBreakdown": [{ "name": "detail", "quantity": 0, "unit": "unit label or empty", "unitPrice": 0, "lineTotal": 0, "amount": 0, "amountUsd": 0, "amountThs": 0 }],
        "counterparty": "counterparty or statement source",
        "description": "reviewable ledger line",
        "amount": 0,
        "currency": "USD|TZS",
        "amountUsd": 0,
        "amountThs": 0,
        "fxUsdThs": 2600,
        "fxThsUsd": 0.0003846154,
        "reference": "invoice number, financial baseline date, or source reference",
        "documentType": "Other",
        "ifrsTreatment": "Revenue Recognition|Operating Expense|PPE Capitalization|Liability Recognition|Manual Adjustment",
        "ifrsNotes": "short baseline classification note",
        "questions": []
      }
    ]
  }
}

Rules:
- Use numbers only for amount and taxAmount.
- Use numbers only for amountUsd, amountThs, fxUsdThs, fxThsUsd, quantity, unitPrice, lineTotal, assetUsefulLifeMonths, and subcategoryBreakdown amounts.
- Keep amount equal to the full invoice total. Do not sum line items into additional ledger entries. Line item quantity/unit/lineTotal are informational audit fields only.
- Validate internally that the subcategoryBreakdown source-currency amount sum equals amount. If it does not, correct the allocation before returning JSON.
- For normal invoice or proof-of-payment extraction, action is "create".
- For a user request to modify/correct/change an existing entry, action is "update".
- For a user request to remove/delete/cancel an existing ledger entry, action is "delete".
- For update/delete, only choose a targetEntryId when the existing entry is clearly identifiable from the active-property ledger list.
- Use the document's currency when visible; default to the active property currency.
- Do not invent invoice numbers, dates, tax, or payment references.
- If multiple line items exist, use the accounting category for the group and put each meaningful line item into subcategories.
- Use hotel finance language, concise and operational.
- For normal single-document extraction, extraction.entries can be omitted or empty unless the document may be an asset purchase.
- For asset purchase or capitalizable improvement documents, put both the Expense and Asset candidates in extraction.entries so the user can decide what to post.
- For financial baseline import, set extraction.action to "create", extraction.type to "Unknown" if the batch contains mixed types, and put all proposed ledger lines in extraction.entries.
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
  if (value === "TZS" || value === "THS") return "TZS";
  return "USD";
}

function roundMoney(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
}

function buildDualCurrencyAmounts(amount: number, currency: string, fxUsdThs?: number, fxThsUsd?: number) {
  const normalizedCurrency = normalizeCurrency(currency);
  const safeFxUsdThs = Number(fxUsdThs || defaultFxUsdThs);
  const safeFxThsUsd = Number(fxThsUsd || (safeFxUsdThs ? 1 / safeFxUsdThs : defaultFxThsUsd));

  if (normalizedCurrency === "TZS") {
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
        const quantity = Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : undefined;
        const unitPrice = Number.isFinite(Number(item.unitPrice)) ? Number(item.unitPrice) : undefined;
        const computedLineTotal = quantity && unitPrice ? roundMoney(quantity * unitPrice, currency === "TZS" ? 0 : 2) : undefined;
        const lineTotal = Number.isFinite(Number(item.lineTotal)) ? Number(item.lineTotal) : computedLineTotal;
        const amount = Number.isFinite(Number(item.amount)) ? Number(item.amount) : Number(lineTotal || 0);
        const fx = buildDualCurrencyAmounts(amount, currency, fxUsdThs, fxThsUsd);
        const unitFx = unitPrice !== undefined
          ? buildDualCurrencyAmounts(unitPrice, currency, fxUsdThs, fxThsUsd)
          : null;
        const lineFx = Number.isFinite(Number(lineTotal))
          ? buildDualCurrencyAmounts(Number(lineTotal), currency, fxUsdThs, fxThsUsd)
          : fx;
        return {
          name: String(item.name || "").trim(),
          quantity,
          unit: String(item.unit || "").trim(),
          unitPrice,
          lineTotal: Number.isFinite(Number(lineTotal)) ? Number(lineTotal) : amount,
          amount,
          amountUsd: Number.isFinite(Number(item.amountUsd)) ? Number(item.amountUsd) : fx.amountUsd,
          amountThs: Number.isFinite(Number(item.amountThs)) ? Number(item.amountThs) : fx.amountThs,
          unitPriceUsd: Number.isFinite(Number(item.unitPriceUsd)) ? Number(item.unitPriceUsd) : unitFx?.amountUsd,
          unitPriceThs: Number.isFinite(Number(item.unitPriceThs)) ? Number(item.unitPriceThs) : unitFx?.amountThs,
          lineTotalUsd: Number.isFinite(Number(item.lineTotalUsd)) ? Number(item.lineTotalUsd) : lineFx.amountUsd,
          lineTotalThs: Number.isFinite(Number(item.lineTotalThs)) ? Number(item.lineTotalThs) : lineFx.amountThs,
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
      lineTotal: splitAmount,
      lineTotalUsd: fx.amountUsd,
      lineTotalThs: fx.amountThs,
    };
  });
}

function normalizeSingleExtraction(extraction: any, propertyCurrency = "USD") {
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
    ifrsTreatment: String(extraction.ifrsTreatment || ""),
    capitalizationCandidate: Boolean(extraction.capitalizationCandidate),
    assetUsefulLifeMonths: Number.isFinite(Number(extraction.assetUsefulLifeMonths)) ? Number(extraction.assetUsefulLifeMonths) : 0,
    depreciationMethod: String(extraction.depreciationMethod || ""),
    ifrsNotes: String(extraction.ifrsNotes || ""),
    questions: Array.isArray(extraction.questions) ? extraction.questions.map(String) : [],
  };
}

function normalizeAssistantPayload(payload: any, propertyCurrency = "USD") {
  const extraction = payload?.extraction || {};
  const normalizedExtraction = normalizeSingleExtraction(extraction, propertyCurrency);
  const rawEntries = Array.isArray(extraction.entries)
    ? extraction.entries
    : Array.isArray(payload?.entries)
      ? payload.entries
      : [];
  const entries = rawEntries.length
    ? rawEntries
      .map((entry: any) => normalizeSingleExtraction({ action: "create", ...entry }, propertyCurrency))
      .filter((entry: any) => entry.type !== "Unknown" && entry.category && Number(entry.amount))
    : [];

  return {
    reply: typeof payload?.reply === "string" && payload.reply.trim()
      ? payload.reply.trim()
      : safeUnableToExtractResponse.reply,
    extraction: {
      ...normalizedExtraction,
      entries,
    },
  };
}

function forceAttachedDocumentProposal(payload: any, context: { hasFiles: boolean; mode: string; propertyCurrency?: string }) {
  if (!context.hasFiles || context.mode === "financial-baseline") return payload;
  const extraction = payload?.extraction;
  if (!extraction) return payload;
  if (Array.isArray(extraction.entries) && extraction.entries.length) return payload;
  const action = String(extraction.action || "");
  const type = String(extraction.type || "");
  const amount = Number(extraction.amount || 0);
  const hasUsefulFinancialContent = amount || extraction.category || extraction.counterparty || extraction.subcategoryBreakdown?.length || extraction.subcategories?.length;
  if (!hasUsefulFinancialContent) return payload;
  if (action !== "none" && type !== "Unknown") return payload;

  const combinedText = [
    extraction.category,
    extraction.counterparty,
    extraction.description,
    extraction.documentType,
    extraction.reference,
    extraction.ifrsNotes,
    ...(Array.isArray(extraction.subcategories) ? extraction.subcategories : []),
    ...(Array.isArray(extraction.subcategoryBreakdown) ? extraction.subcategoryBreakdown.map((item: any) => item?.name) : []),
  ].filter(Boolean).join(" ").toLowerCase();

  const looksLikeRevenue = /proof|payment|receipt|customer|client|guest|reservation|booking|ota|agency|tour operator|payout/i.test(combinedText);
  const looksLikeAsset = /asset|fixed|furniture|bed|mattress|equipment|vehicle|machinery|construction|renovation|improvement|terrace|lounge|bar|capex|capital/i.test(combinedText);
  const inferredType = looksLikeRevenue ? "Revenue" : looksLikeAsset ? "Asset" : "Expense";
  const fallbackCategory = extraction.category || (inferredType === "Revenue" ? "Customer Payment" : inferredType === "Asset" ? "Fixed Assets" : "Supplier Invoice");
  const notes = [
    extraction.ifrsNotes,
    "Attached source document was treated as an invoice/accounting source for review. If the source says proforma, quotation, or proposal, confirm before posting.",
  ].filter(Boolean).join(" ");

  return {
    ...payload,
    reply: payload.reply && !/please confirm|please review/i.test(payload.reply)
      ? `${payload.reply} I prepared a reviewable Accountancy proposal because a source document was attached. Please confirm or edit before posting.`
      : payload.reply || "I prepared a reviewable Accountancy proposal from the attached source document. Please confirm or edit before posting.",
    extraction: {
      ...extraction,
      action: "create",
      type: inferredType,
      confidence: Number(extraction.confidence || 0.65),
      category: fallbackCategory,
      counterparty: extraction.counterparty || "Document counterparty",
      description: extraction.description || `${fallbackCategory} from attached source document`,
      amount,
      currency: normalizeCurrency(extraction.currency || context.propertyCurrency || "USD"),
      documentType: extraction.documentType === "Proof of Payment" ? "Proof of Payment" : "Supplier Invoice",
      ifrsTreatment: extraction.ifrsTreatment || (inferredType === "Revenue" ? "Revenue Recognition" : inferredType === "Asset" ? "PPE Capitalization" : "Operating Expense"),
      capitalizationCandidate: Boolean(extraction.capitalizationCandidate || inferredType === "Asset"),
      ifrsNotes: notes,
      questions: Array.isArray(extraction.questions) ? extraction.questions : [],
    },
  };
}

function looksLikeCapitalAssetSource(extraction: any) {
  const combinedText = [
    extraction?.category,
    extraction?.counterparty,
    extraction?.description,
    extraction?.documentType,
    extraction?.reference,
    extraction?.ifrsTreatment,
    extraction?.ifrsNotes,
    ...(Array.isArray(extraction?.subcategories) ? extraction.subcategories : []),
    ...(Array.isArray(extraction?.subcategoryBreakdown) ? extraction.subcategoryBreakdown.map((item: any) => item?.name) : []),
  ].filter(Boolean).join(" ").toLowerCase();

  return Boolean(extraction?.capitalizationCandidate) ||
    /ppe capitalization|fixed asset|capitalization|capitalisable|capitalizable|asset|furniture|bed|mattress|equipment|vehicle|machinery|construction|renovation|improvement|terrace|lounge|bar|capex|capital/i.test(combinedText);
}

function buildSyncedAssetExpenseEntry(base: any, type: "Expense" | "Asset", propertyCurrency = "USD") {
  const currency = normalizeCurrency(base.currency || propertyCurrency || "USD");
  const amount = Number(base.amount || 0);
  const fx = buildDualCurrencyAmounts(amount, currency, base.fxUsdThs, base.fxThsUsd);
  const category = type === "Asset"
    ? (/asset|fixed|furniture|equipment|improvement|renovation/i.test(String(base.category || "")) ? base.category : "Fixed Assets")
    : (/expense|supply|maintenance|purchase|cost/i.test(String(base.category || "")) ? base.category : "Asset Purchase Expense");
  const ifrsNotes = [
    base.ifrsNotes,
    type === "Asset"
      ? "Asset-side proposal: review whether this purchase should increase Balance assets."
      : "Expense-side proposal: review whether this invoice should also affect Profit & Loss.",
  ].filter(Boolean).join(" ");

  return {
    action: "create",
    type,
    date: base.date || "",
    category,
    subcategories: Array.isArray(base.subcategories) ? base.subcategories : [],
    subcategoryBreakdown: Array.isArray(base.subcategoryBreakdown) ? base.subcategoryBreakdown : [],
    counterparty: base.counterparty || "Document counterparty",
    description: base.description || `${category} from attached source document`,
    amount,
    currency,
    amountUsd: Number.isFinite(Number(base.amountUsd)) ? Number(base.amountUsd) : fx.amountUsd,
    amountThs: Number.isFinite(Number(base.amountThs)) ? Number(base.amountThs) : fx.amountThs,
    fxUsdThs: fx.fxUsdThs,
    fxThsUsd: fx.fxThsUsd,
    supplierInvoiceId: base.supplierInvoiceId || "",
    documentType: base.documentType || "Supplier Invoice",
    paymentMethod: base.paymentMethod || "",
    reference: base.reference || base.supplierInvoiceId || "",
    taxAmount: Number(base.taxAmount || 0),
    ifrsTreatment: type === "Asset" ? "PPE Capitalization" : "Operating Expense",
    capitalizationCandidate: type === "Asset",
    assetUsefulLifeMonths: Number(base.assetUsefulLifeMonths || 0),
    depreciationMethod: type === "Asset" ? (base.depreciationMethod || "Straight-line") : "",
    ifrsNotes,
    questions: Array.isArray(base.questions) ? base.questions : [],
  };
}

function ensureAssetPurchaseSyncProposal(payload: any, context: { hasFiles: boolean; mode: string; propertyCurrency?: string }) {
  if (!context.hasFiles || context.mode === "financial-baseline") return payload;
  const extraction = payload?.extraction;
  if (!extraction) return payload;

  const rawEntries = Array.isArray(extraction.entries) ? extraction.entries : [];
  const sourceCandidates = rawEntries.length ? rawEntries : [extraction];
  const hasAssetSignal = sourceCandidates.some(looksLikeCapitalAssetSource);
  if (!hasAssetSignal) return payload;

  const amount = Number(extraction.amount || sourceCandidates.find((entry: any) => Number(entry.amount))?.amount || 0);
  if (!amount) return payload;

  const inheritedBreakdown = Array.isArray(extraction.subcategoryBreakdown) ? extraction.subcategoryBreakdown : [];
  const inheritedSubcategories = Array.isArray(extraction.subcategories) ? extraction.subcategories : [];
  const existingEntries = rawEntries.length
    ? rawEntries.map((entry: any) => ({
      ...entry,
      date: entry.date || extraction.date,
      amount: Number(entry.amount || amount),
      currency: entry.currency || extraction.currency,
      amountUsd: Number.isFinite(Number(entry.amountUsd)) ? Number(entry.amountUsd) : extraction.amountUsd,
      amountThs: Number.isFinite(Number(entry.amountThs)) ? Number(entry.amountThs) : extraction.amountThs,
      fxUsdThs: entry.fxUsdThs || extraction.fxUsdThs,
      fxThsUsd: entry.fxThsUsd || extraction.fxThsUsd,
      counterparty: entry.counterparty || extraction.counterparty,
      description: entry.description || extraction.description,
      subcategories: Array.isArray(entry.subcategories) && entry.subcategories.length ? entry.subcategories : inheritedSubcategories,
      subcategoryBreakdown: Array.isArray(entry.subcategoryBreakdown) && entry.subcategoryBreakdown.length ? entry.subcategoryBreakdown : inheritedBreakdown,
      supplierInvoiceId: entry.supplierInvoiceId || extraction.supplierInvoiceId,
      documentType: entry.documentType || extraction.documentType || "Supplier Invoice",
      paymentMethod: entry.paymentMethod || extraction.paymentMethod || "",
      reference: entry.reference || extraction.reference || extraction.supplierInvoiceId || "",
      taxAmount: Number(entry.taxAmount || extraction.taxAmount || 0),
      assetUsefulLifeMonths: Number(entry.assetUsefulLifeMonths || extraction.assetUsefulLifeMonths || 0),
      depreciationMethod: entry.depreciationMethod || extraction.depreciationMethod || "",
      questions: Array.isArray(entry.questions) && entry.questions.length ? entry.questions : extraction.questions,
    }))
    : [];
  const hasExpense = existingEntries.some((entry: any) => entry.type === "Expense");
  const hasAsset = existingEntries.some((entry: any) => entry.type === "Asset");
  const base = { ...extraction, amount };
  const nextEntries = [...existingEntries];
  if (!hasExpense) nextEntries.unshift(buildSyncedAssetExpenseEntry(base, "Expense", context.propertyCurrency));
  if (!hasAsset) nextEntries.push(buildSyncedAssetExpenseEntry(base, "Asset", context.propertyCurrency));

  return {
    ...payload,
    reply: "I detected that the attached source may relate to an asset purchase or capitalizable improvement. I prepared a multi-section proposal so you can confirm whether it should post to Expense, Asset, or both before anything is synchronized.",
    extraction: {
      ...extraction,
      action: "create",
      type: "Unknown",
      entries: nextEntries,
      questions: [
        ...(Array.isArray(extraction.questions) ? extraction.questions : []),
        "Confirm whether this source should be posted as Expense, Asset, or both. You can remove or edit any line before confirming.",
      ],
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
  const { message = "", files = [], property = {}, accountancyEntries = [], mode = "transactions" } = requestPayload;
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

Assistant mode:
${mode === "financial-baseline" ? "Financial Baseline Setup. The user is providing P&L and Balance statements to create the current/opening accounting position for this property. Return all statement lines as extraction.entries for review." : "Document Chat. Return one reviewable accounting candidate, or a multi-section extraction.entries proposal when an attached supplier document may need both Expense and Asset treatment."}

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
      const forcedPayload = forceAttachedDocumentProposal(parsed, {
        hasFiles: Boolean(files.length),
        mode,
        propertyCurrency: property.currency || "USD",
      });
      const preparedPayload = ensureAssetPurchaseSyncProposal(forcedPayload, {
        hasFiles: Boolean(files.length),
        mode,
        propertyCurrency: property.currency || "USD",
      });
      res.status(200).json({ ...normalizeAssistantPayload(preparedPayload, property.currency || "USD"), model });
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

