import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bot, Download, FileText, LockKeyhole, Paperclip, Plus, Send, Sparkles, X } from "lucide-react";
import type { AccountancyAttachment, AccountancyEntry } from "../../context/AppContext";
import { useAppContext } from "../../context/AppContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { AccountancyCurrencyFilter } from "../../components/accountancy/AccountancyCurrencyFilter";
import { AccountancyDateRangeFilter } from "../../components/accountancy/AccountancyDateRangeFilter";
import {
  buildDualCurrencyAmounts,
  filterEntriesByDateRange,
  formatDisplayMoney,
  formatMoney,
  getDefaultAccountancyDateRange,
  getDatedCategoryName,
  getEntryDisplayAmount,
  getEntryThsAmount,
  getEntryUsdAmount,
  normalizeAccountancyEntry,
  normalizeCurrency,
  roundMoney,
} from "../../utils/accountancy";
import { uploadAccountancyAttachments } from "../../utils/accountancyAttachments";
import { fetchFxRateForDate } from "../../utils/fxRates";
import { exportToPDF } from "../../utils/export";

type AssistantAction = "create" | "update" | "delete" | "none";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  extraction?: AssistantExtraction;
};

type AssistantExtraction = {
  action?: AssistantAction;
  targetEntryId?: string;
  targetReference?: string;
  type: AccountancyEntry["type"] | "Unknown";
  confidence?: number;
  date?: string;
  category?: string;
  subcategories?: string[];
  subcategoryBreakdown?: {
    name: string;
    amount: number;
    amountUsd?: number;
    amountThs?: number;
  }[];
  counterparty?: string;
  description?: string;
  amount?: number;
  currency?: string;
  amountUsd?: number;
  amountThs?: number;
  fxUsdThs?: number;
  fxThsUsd?: number;
  reservationId?: string;
  customerInvoiceId?: string;
  supplierInvoiceId?: string;
  documentType?: AccountancyEntry["documentType"];
  paymentMethod?: string;
  reference?: string;
  taxAmount?: number;
  questions?: string[];
};

type PendingAction = {
  action: Exclude<AssistantAction, "none">;
  targetEntryId?: string;
  original?: AccountancyEntry | null;
  draft: Partial<AccountancyEntry>;
};

type UploadPayload = {
  name: string;
  mimeType: string;
  data: string;
};

const emptyDraft: Partial<AccountancyEntry> = {
  type: "Revenue",
  date: new Date().toISOString().split("T")[0],
  category: "",
  subcategories: [],
  subcategoryBreakdown: [{ name: "", amount: 0, amountUsd: 0, amountThs: 0 }],
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
};

export function AccountancyGenAIAssistant() {
  const {
    selectedPropertyId,
    properties,
    accountancyEntries,
    addAccountancyEntry,
    updateAccountancyEntry,
    deleteAccountancyEntry,
    accountancyDisplayCurrency,
  } = useAppContext();
  const activeProperty = properties.find(property => property.id === selectedPropertyId);
  const propertyEntries = useMemo(
    () => accountancyEntries.filter(entry => entry.propertyId === selectedPropertyId),
    [accountancyEntries, selectedPropertyId],
  );
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Upload or describe a supplier invoice, proof of payment, asset, liability, or accounting change. I will prepare a proposal first. Revenues and Expenses feed P&L; Assets and Liabilities feed Balance. Nothing is posted, edited, or deleted until you confirm it here.",
    },
  ]);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [dateRange, setDateRange] = useState(getDefaultAccountancyDateRange);
  const [error, setError] = useState("");

  const recentAiEntries = useMemo(
    () => filterEntriesByDateRange(propertyEntries.filter(entry => entry.source === "GenAI Assistant"), dateRange).slice(0, 5),
    [propertyEntries, dateRange],
  );

  const exportAssistantPdf = () => {
    const pendingRows = pendingAction && pendingAction.action !== "delete"
      ? [{
        Status: "Pending review",
        Action: pendingAction.action,
        Type: pendingAction.draft.type || "",
        Date: pendingAction.draft.date || "",
        Category: getDatedCategoryName(pendingAction.draft.category || "Uncategorized", pendingAction.draft.date),
        Counterparty: pendingAction.draft.counterparty || "",
        Reference: pendingAction.draft.reference || "",
        Amount: `${pendingAction.draft.type === "Expense" || pendingAction.draft.type === "Liability" ? "-" : ""}${formatDisplayMoney(getEntryDisplayAmount(pendingAction.draft as AccountancyEntry, accountancyDisplayCurrency), accountancyDisplayCurrency)}`,
        Subcategories: pendingAction.draft.subcategoryBreakdown?.map(item => `${item.name}: ${formatMoney(Number(item.amount || 0), pendingAction.draft.currency || "USD")}`).join(", ") || "",
      }]
      : [];

    const postedRows = recentAiEntries.map(entry => ({
      Status: "Posted",
      Action: "Confirmed",
      Type: entry.type,
      Date: entry.date,
      Category: getDatedCategoryName(entry.category, entry.date),
      Counterparty: entry.counterparty,
      Reference: entry.reference || "",
      Amount: `${entry.type === "Expense" || entry.type === "Liability" ? "-" : ""}${formatDisplayMoney(getEntryDisplayAmount(entry, accountancyDisplayCurrency), accountancyDisplayCurrency)}`,
      Subcategories: entry.subcategoryBreakdown?.map(item => `${item.name}: ${formatMoney(Number(item.amount || 0), entry.currency)}`).join(", ") || "",
    }));

    exportToPDF([...pendingRows, ...postedRows], "GenAI-Assistant", "GenAI Assistant - Accountancy");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim() && files.length === 0) return;

    setError("");
    setIsLoading(true);
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: [
        input.trim(),
        files.length ? `Attached files: ${files.map(file => file.name).join(", ")}` : "",
      ].filter(Boolean).join("\n"),
    };
    setMessages(current => [...current, userMessage]);

    try {
      const uploadPayload = await Promise.all(files.map(fileToPayload));
      const response = await fetch("/api/genai-accountancy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input.trim(),
          files: uploadPayload,
          property: {
            id: selectedPropertyId,
            name: activeProperty?.name || "",
            legalName: activeProperty?.legalName || "",
            invoiceEmail: activeProperty?.invoiceEmail || "",
            currency: activeProperty?.currency || "USD",
          },
          accountancyEntries: propertyEntries.map(entry => ({
            id: entry.id,
            type: entry.type,
            date: entry.date,
            category: entry.category,
            subcategories: entry.subcategories || [],
            subcategoryBreakdown: entry.subcategoryBreakdown || [],
            counterparty: entry.counterparty,
            amount: entry.amount,
            currency: entry.currency,
            amountUsd: entry.amountUsd,
            amountThs: entry.amountThs,
            fxUsdThs: entry.fxUsdThs,
            fxThsUsd: entry.fxThsUsd,
            reservationId: entry.reservationId || "",
            customerInvoiceId: entry.customerInvoiceId || "",
            supplierInvoiceId: entry.supplierInvoiceId || "",
            reference: entry.reference || "",
            description: entry.description,
            source: entry.source,
          })),
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null) as { error?: string; detail?: string } | null;
        throw new Error(
          errorPayload?.detail ||
          errorPayload?.error ||
          `The GenAI service returned ${response.status}. Check GEMINI_API_KEY in Vercel/local environment variables.`
        );
      }

      const data = await response.json() as { reply?: string; extraction?: AssistantExtraction; model?: string };
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: "assistant",
        content: data.reply || "I prepared an Accountancy proposal. Please review it before confirming.",
        extraction: data.extraction,
      };
      setMessages(current => [...current, assistantMessage]);

      if (data.extraction) {
        buildPendingAction(data.extraction, data.reply || "", files.map(file => file.name).join(", "), files);
      }
      setInput("");
      setFiles([]);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "The assistant could not process the request.";
      setError(message);
      setMessages(current => [
        ...current,
        {
          id: `msg-${Date.now()}-error`,
          role: "assistant",
          content: `I could not complete the GenAI process. No accounting data was changed.\n\nTechnical detail: ${message}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const buildPendingAction = (extraction: AssistantExtraction, rawSummary: string, attachmentName: string, sourceFiles: File[]) => {
    const action = extraction.action || "create";
    if (action === "none" || (action === "create" && extraction.type === "Unknown")) {
      setPendingAction(null);
      setPendingFiles([]);
      return;
    }

    const target = action === "update" || action === "delete"
      ? resolveTargetEntry(extraction, propertyEntries)
      : null;

    if ((action === "update" || action === "delete") && !target) {
      setPendingAction(null);
      setMessages(current => [
        ...current,
        {
          id: `msg-${Date.now()}-missing-target`,
          role: "assistant",
          content: "I understand the accounting change, but I need a clearer entry reference before I can prepare the update/delete confirmation. Please specify the ledger entry reference, category, counterparty, amount, or ID.",
        },
      ]);
      return;
    }

    const base = target || emptyDraft;
    const draft: Partial<AccountancyEntry> = recalculateDraft({
      ...base,
      type: extraction.type !== "Unknown" ? extraction.type : base.type,
      date: extraction.date || base.date || emptyDraft.date,
      category: extraction.category || base.category || "",
      subcategories: extraction.subcategories?.length ? extraction.subcategories : base.subcategories || [],
      subcategoryBreakdown: extraction.subcategoryBreakdown?.length
        ? extraction.subcategoryBreakdown.map(item => ({
          name: item.name,
          amount: Number(item.amount || 0),
          amountUsd: Number(item.amountUsd || 0),
          amountThs: Number(item.amountThs || 0),
        }))
        : base.subcategoryBreakdown || emptyDraft.subcategoryBreakdown,
      counterparty: extraction.counterparty || base.counterparty || "",
      description: extraction.description || base.description || "",
      amount: Number(extraction.amount ?? base.amount ?? 0),
      currency: extraction.currency || base.currency || activeProperty?.currency || "USD",
      amountUsd: Number(extraction.amountUsd ?? base.amountUsd ?? 0),
      amountThs: Number(extraction.amountThs ?? base.amountThs ?? 0),
      fxUsdThs: Number(extraction.fxUsdThs ?? base.fxUsdThs ?? 2600),
      fxThsUsd: Number(extraction.fxThsUsd ?? base.fxThsUsd ?? 1 / 2600),
      reservationId: extraction.reservationId || base.reservationId || "",
      customerInvoiceId: extraction.customerInvoiceId || base.customerInvoiceId || "",
      supplierInvoiceId: extraction.supplierInvoiceId || base.supplierInvoiceId || "",
      documentType: extraction.documentType || base.documentType || (extraction.type === "Expense" ? "Supplier Invoice" : "Proof of Payment"),
      paymentMethod: extraction.paymentMethod || base.paymentMethod || "",
      reference: extraction.reference || base.reference || extraction.targetReference || "",
      taxAmount: Number(extraction.taxAmount ?? base.taxAmount ?? 0),
      attachmentName: attachmentName || base.attachmentName,
      attachments: base.attachments || [],
      rawSummary,
    });

    setPendingFiles(sourceFiles);
    setPendingAction({
      action,
      targetEntryId: target?.id || extraction.targetEntryId,
      original: target,
      draft,
    });
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) return;

    if (pendingAction.action === "delete") {
      if (!pendingAction.targetEntryId || pendingAction.original?.propertyId !== selectedPropertyId) {
        setError("This delete proposal is not valid for the active property.");
        return;
      }
      deleteAccountancyEntry(pendingAction.targetEntryId);
      appendPostedMessage(`Deleted ${pendingAction.original.type.toLowerCase()} entry "${getDatedCategoryName(pendingAction.original.category, pendingAction.original.date)}" from Accountancy. ${statementImpact(pendingAction.original.type)} and Overview are now updated.`);
      setPendingAction(null);
      setPendingFiles([]);
      setError("");
      return;
    }

    const draft = recalculateDraft(pendingAction.draft);
    if (!draft.type || !draft.date || !draft.category || !draft.counterparty || !draft.description || !Number(draft.amount)) {
      setError("Complete type, date, category, counterparty, description, and amount before confirming.");
      return;
    }
    const subcategoryError = validateSubcategoryTotals(draft);
    if (subcategoryError) {
      setError(subcategoryError);
      return;
    }
    const normalizedDraft = normalizeForPosting(draft);
    const entryId = pendingAction.targetEntryId || normalizedDraft.id || `acc-${Date.now()}`;
    let uploadedAttachments: AccountancyAttachment[] = [];
    if (pendingFiles.length) {
      try {
        uploadedAttachments = await uploadAccountancyAttachments({
          propertyId: selectedPropertyId,
          entryId,
          files: pendingFiles,
          source: "GenAI Assistant",
        });
      } catch (error) {
        setError(error instanceof Error ? error.message : "Could not upload the source documents. Nothing was posted.");
        return;
      }
    }
    const attachments = [
      ...(normalizedDraft.attachments || pendingAction.original?.attachments || []),
      ...uploadedAttachments,
    ];

    const payload: AccountancyEntry = {
      id: entryId,
      propertyId: selectedPropertyId,
      type: normalizedDraft.type,
      date: normalizedDraft.date,
      category: normalizedDraft.category,
      subcategories: normalizedDraft.subcategories || [],
      subcategoryBreakdown: normalizedDraft.subcategoryBreakdown || [],
      counterparty: normalizedDraft.counterparty,
      description: normalizedDraft.description,
      amount: Number(normalizedDraft.amount),
      currency: normalizedDraft.currency || "USD",
      amountUsd: normalizedDraft.amountUsd,
      amountThs: normalizedDraft.amountThs,
      fxUsdThs: normalizedDraft.fxUsdThs,
      fxThsUsd: normalizedDraft.fxThsUsd,
      reservationId: normalizedDraft.reservationId,
      customerInvoiceId: normalizedDraft.customerInvoiceId,
      supplierInvoiceId: normalizedDraft.supplierInvoiceId,
      documentType: normalizedDraft.documentType || "Other",
      paymentMethod: normalizedDraft.paymentMethod,
      reference: normalizedDraft.reference,
      taxAmount: Number(normalizedDraft.taxAmount || 0),
      source: pendingAction.action === "update" ? (pendingAction.original?.source || "GenAI Assistant") : "GenAI Assistant",
      status: "Confirmed",
      attachments,
      attachmentName: attachments.length ? attachments.map(item => item.name).join(", ") : normalizedDraft.attachmentName,
      rawSummary: normalizedDraft.rawSummary,
      createdAt: pendingAction.original?.createdAt || new Date().toISOString(),
    };

    if (pendingAction.action === "update") {
      const original = pendingAction.original;
      if (!original || original.propertyId !== selectedPropertyId) {
        setError("This update proposal is not valid for the active property.");
        return;
      }
      updateAccountancyEntry(original.id, payload);
      appendPostedMessage(`Updated ${payload.type.toLowerCase()} entry "${payload.category}" for ${formatDisplayMoney(getEntryDisplayAmount(payload, accountancyDisplayCurrency), accountancyDisplayCurrency)}. ${statementImpact(payload.type)} and Overview are now recalculated.`);
    } else {
      addAccountancyEntry(payload);
      appendPostedMessage(`${payload.type} posted to Accountancy for ${formatDisplayMoney(getEntryDisplayAmount(payload, accountancyDisplayCurrency), accountancyDisplayCurrency)}. ${statementImpact(payload.type)} and Overview are now updated.`);
    }

    setPendingAction(null);
    setPendingFiles([]);
    setError("");
  };

  const appendPostedMessage = (content: string) => {
    setMessages(current => [
      ...current,
      {
        id: `msg-${Date.now()}-confirmed`,
        role: "assistant",
        content,
      },
    ]);
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Accountancy Intelligence</p>
          <h1 className="text-3xl font-bold">GenAI Assistant</h1>
          <p className="text-muted-foreground">Create, review, modify, or delete revenues, expenses, assets, and liabilities only after explicit confirmation.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AccountancyDateRangeFilter compact value={dateRange} onChange={setDateRange} />
          <AccountancyCurrencyFilter compact />
          <Button variant="outline" size="sm" onClick={exportAssistantPdf}>
            <Download className="mr-2 h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm">
        <div className="flex gap-3">
          <LockKeyhole className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold">Accountancy-only guardrail</p>
            <p className="text-muted-foreground">This assistant can only prepare changes for the active property ledger in Accountancy. Confirmed Revenue and Expense entries feed Profit & Loss; confirmed Asset and Liability entries feed Balance. It cannot change Reservations, Supply Requests, Check-in, Admin Platform, Owner Console, companies, properties, users, or permissions.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_560px] 2xl:grid-cols-[minmax(0,1fr)_620px]">
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="border-b border-border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">Document Chat</h2>
                <p className="text-sm text-muted-foreground">Active property: {activeProperty?.name || "No property selected"}</p>
              </div>
            </div>
          </div>

          <div className="h-[520px] space-y-4 overflow-y-auto p-4 sm:p-5">
            {messages.map(message => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[92%] rounded-lg border px-4 py-3 text-sm shadow-sm sm:max-w-[82%] ${
                  message.role === "user"
                    ? "border-primary/40 bg-primary text-primary-foreground"
                    : "border-border bg-background"
                }`}>
                  <div className="whitespace-pre-line">{message.content}</div>
                  {message.extraction && message.extraction.type !== "Unknown" && (
                    <div className="mt-3 rounded-md border border-border bg-card p-3 text-foreground">
                      <p className="font-semibold">{(message.extraction.action || "create").toUpperCase()} proposal</p>
                      <p className="text-muted-foreground">{getDatedCategoryName(message.extraction.category || "Uncategorized", message.extraction.date)} - {formatMoney(Number(message.extraction.amount || 0), message.extraction.currency || "USD")}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">Gemini is preparing an Accountancy proposal...</div>
              </div>
            )}
          </div>

          <form className="border-t border-border bg-muted/20 p-4" onSubmit={handleSubmit}>
            {error && <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            <div className="mb-3 flex flex-wrap gap-2">
              {files.map(file => (
                <span key={file.name} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1 text-xs">
                  <FileText className="h-3.5 w-3.5" />
                  {file.name}
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
                <Paperclip className="mr-2 h-4 w-4" />
                Attach
                <input
                  className="hidden"
                  type="file"
                  multiple
                  accept="image/*,application/pdf,text/plain,text/csv"
                  onChange={event => setFiles(Array.from(event.target.files || []))}
                />
              </label>
              <Input
                className="min-h-10 flex-1"
                value={input}
                onChange={event => setInput(event.target.value)}
                placeholder="Ask Gemini to create, edit, or delete an Accountancy entry..."
              />
              <Button type="submit" disabled={isLoading}>
                <Send className="mr-2 h-4 w-4" />
                Send
              </Button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <ReviewPanel pendingAction={pendingAction} setPendingAction={setPendingAction} onConfirm={confirmPendingAction} />
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Recent AI Postings</h2>
            </div>
            <div className="mt-4 space-y-3">
              {recentAiEntries.map(entry => (
                <div key={entry.id} className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{entry.category}</span>
                    <span className={entry.type === "Revenue" || entry.type === "Asset" ? "text-green-600" : "text-destructive"}>
                      {entry.type === "Expense" || entry.type === "Liability" ? "-" : ""}{formatDisplayMoney(getEntryDisplayAmount(entry, accountancyDisplayCurrency), accountancyDisplayCurrency)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entry.subcategoryBreakdown?.length
                      ? entry.subcategoryBreakdown.map(item => `${item.name}: ${formatMoney(item.amount, entry.currency)}`).join(", ")
                      : entry.subcategories?.length ? entry.subcategories.join(", ") : "Unassigned subcategory"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatMoney(getEntryThsAmount(entry), "TZS")} | FX_USD_TZS {Number(entry.fxUsdThs || 0).toFixed(4)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{entry.counterparty} - {entry.date}</p>
                </div>
              ))}
              {!recentAiEntries.length && <p className="text-sm text-muted-foreground">No GenAI postings yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function statementImpact(type: AccountancyEntry["type"]) {
  return type === "Revenue" || type === "Expense"
    ? "Profit & Loss"
    : "Balance";
}

function ReviewPanel({
  pendingAction,
  setPendingAction,
  onConfirm,
}: {
  pendingAction: PendingAction | null;
  setPendingAction: (action: PendingAction | null) => void;
  onConfirm: () => void;
}) {
  if (!pendingAction) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">Review & Confirm</h2>
        <p className="mt-2 text-sm text-muted-foreground">The proposed create, update, or delete action will appear here. No Accountancy changes happen without confirmation.</p>
      </div>
    );
  }

  return <ActiveReviewPanel pendingAction={pendingAction} setPendingAction={setPendingAction} onConfirm={onConfirm} />;
}

function ActiveReviewPanel({
  pendingAction,
  setPendingAction,
  onConfirm,
}: {
  pendingAction: PendingAction;
  setPendingAction: (action: PendingAction | null) => void;
  onConfirm: () => void;
}) {
  const { accountancyDisplayCurrency } = useAppContext();
  const draft = recalculateDraft(pendingAction.draft);
  const updateDraft = (updates: Partial<AccountancyEntry>) => setPendingAction({ ...pendingAction, draft: recalculateDraft({ ...draft, ...updates }) });
  const [fxStatus, setFxStatus] = useState("");
  const isDelete = pendingAction.action === "delete";
  const subcategoryBreakdown = draft.subcategoryBreakdown?.length ? draft.subcategoryBreakdown : [{ name: "", amount: 0, amountUsd: 0, amountThs: 0 }];
  const subcategoryTotal = subcategoryBreakdown.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const displayTotal = draft.type === "Expense" || draft.type === "Liability"
    ? -getEntryDisplayAmount(draft as AccountancyEntry, accountancyDisplayCurrency)
    : getEntryDisplayAmount(draft as AccountancyEntry, accountancyDisplayCurrency);
  const updateSubcategory = (index: number, updates: Partial<NonNullable<AccountancyEntry["subcategoryBreakdown"]>[number]>) => {
    const next = [...subcategoryBreakdown];
    next[index] = { ...next[index], ...updates };
    updateDraft({
      subcategoryBreakdown: next,
      subcategories: next.map(item => item.name).filter(Boolean),
    });
  };
  const addSubcategory = () => updateDraft({ subcategoryBreakdown: [...subcategoryBreakdown, { name: "", amount: 0, amountUsd: 0, amountThs: 0 }] });
  const removeSubcategory = (index: number) => {
    const next = subcategoryBreakdown.filter((_, itemIndex) => itemIndex !== index);
    updateDraft({
      subcategoryBreakdown: next.length ? next : [{ name: "", amount: 0, amountUsd: 0, amountThs: 0 }],
      subcategories: next.map(item => item.name).filter(Boolean),
    });
  };

  useEffect(() => {
    if (!pendingAction || isDelete || !draft.date) return;
    let cancelled = false;

    fetchFxRateForDate(draft.date).then(rate => {
      if (cancelled) return;
      setPendingAction({
        ...pendingAction,
        draft: recalculateDraft({
          ...draft,
          fxUsdThs: rate.fxUsdThs,
          fxThsUsd: rate.fxThsUsd,
        }),
      });
      setFxStatus(`FX loaded from ${rate.source} for ${rate.rateDate}.`);
    });

    return () => {
      cancelled = true;
    };
  }, [draft.date, isDelete]);

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Review & Confirm</h2>
          <p className="text-xs uppercase tracking-wider text-primary">{pendingAction.action} Accountancy entry</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPendingAction(null)}>Clear</Button>
      </div>

      {pendingAction.original && (
        <div className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-sm">
          <p className="font-medium">Target entry</p>
          <p className="text-muted-foreground">{pendingAction.original.id} - {pendingAction.original.category} - {formatMoney(getEntryUsdAmount(pendingAction.original), "USD")}</p>
        </div>
      )}

      {!isDelete && (
        <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Category total</p>
              <h3 className="text-lg font-bold">{getDatedCategoryName(draft.category || "Uncategorized", draft.date)}</h3>
            </div>
            <span className={`text-xl font-bold ${displayTotal < 0 ? "text-destructive" : "text-green-700"}`}>
              {displayTotal < 0 ? "-" : ""}{formatDisplayMoney(Math.abs(displayTotal), accountancyDisplayCurrency)}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {subcategoryBreakdown.filter(item => item.name.trim()).map(item => {
              const amount = accountancyDisplayCurrency === "TZS" ? Number(item.amountThs || 0) : Number(item.amountUsd || 0);
              return (
                <div key={item.name} className="flex items-center justify-between gap-3 rounded-md bg-background/80 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-muted-foreground">{item.name}</span>
                  <span className="font-semibold">{formatDisplayMoney(amount, accountancyDisplayCurrency)}</span>
                </div>
              );
            })}
            {!subcategoryBreakdown.some(item => item.name.trim()) && (
              <p className="text-sm text-muted-foreground">No subcategory amounts detected yet. Add them before confirming if the invoice has line-item categories.</p>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3">
        <label className="block text-sm font-medium">
          Type
          <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.type || "Revenue"} onChange={event => updateDraft({ type: event.target.value as AccountancyEntry["type"] })} disabled={isDelete}>
            <option value="Revenue">Revenue</option>
            <option value="Expense">Expense</option>
            <option value="Asset">Asset</option>
            <option value="Liability">Liability</option>
          </select>
        </label>
        <InputField disabled={isDelete} label="Date" type="date" value={draft.date || ""} onChange={value => updateDraft({ date: value })} />
        <InputField disabled={isDelete} label="Category" value={draft.category || ""} onChange={value => updateDraft({ category: value })} />
        <InputField disabled={isDelete} label="Counterparty" value={draft.counterparty || ""} onChange={value => updateDraft({ counterparty: value })} />
        <InputField disabled={isDelete} label="Reference" value={draft.reference || ""} onChange={value => updateDraft({ reference: value })} />
        <InputField disabled={isDelete} label="Invoice Total" type="number" value={String(draft.amount || 0)} onChange={value => updateDraft({ amount: Number(value) })} />
        <label className="block text-sm font-medium">
          Invoice Currency
          <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={normalizeCurrency(draft.currency)} onChange={event => updateDraft({ currency: event.target.value })} disabled={isDelete}>
            <option value="USD">USD</option>
            <option value="TZS">TZS</option>
          </select>
        </label>
        <InputField disabled={isDelete} label="FX_USD_TZS" type="number" value={String(draft.fxUsdThs || "")} onChange={value => updateDraft({ fxUsdThs: Number(value), fxThsUsd: Number(value) ? 1 / Number(value) : 0 })} />
        <InputField disabled={isDelete} label="FX_TZS_USD" type="number" value={String(draft.fxThsUsd || "")} onChange={value => updateDraft({ fxThsUsd: Number(value), fxUsdThs: Number(value) ? 1 / Number(value) : 0 })} />
        <ReadOnlyValue label="Amount USD" value={formatMoney(getEntryUsdAmount(draft as AccountancyEntry), "USD")} />
        <ReadOnlyValue label="Amount TZS" value={formatMoney(getEntryThsAmount(draft as AccountancyEntry), "TZS")} />
        {fxStatus && <p className="text-xs text-muted-foreground">{fxStatus}</p>}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Subcategories with amount allocation</p>
              <p className="text-xs text-muted-foreground">
                Subcategory total: {formatMoney(subcategoryTotal, draft.currency)} / Invoice total: {formatMoney(Number(draft.amount || 0), draft.currency)}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addSubcategory} disabled={isDelete}>
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>
          {subcategoryBreakdown.map((subcategory, index) => (
            <div key={index} className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Subcategory name
                <Input
                  className="mt-1"
                  value={subcategory.name}
                  onChange={event => updateSubcategory(index, { name: event.target.value })}
                  placeholder={index === 0 ? "e.g., Carrot, Chicken, Cash, Deposit..." : "Additional subcategory"}
                  disabled={isDelete}
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_170px_40px]">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Invoice amount
                  <Input
                    className="mt-1"
                    type="number"
                    value={String(subcategory.amount || 0)}
                    onChange={event => updateSubcategory(index, { amount: Number(event.target.value) })}
                    placeholder="Amount"
                    disabled={isDelete}
                  />
                </label>
                <div className="space-y-2 rounded-md bg-background px-3 py-2 text-xs">
                  <div>
                    <span className="block text-muted-foreground">USD</span>
                    <span className="font-semibold">{formatMoney(subcategory.amountUsd || 0, "USD")}</span>
                  </div>
                  <div>
                    <span className="block text-muted-foreground">TZS</span>
                    <span className="font-semibold">{formatMoney(subcategory.amountThs || 0, "TZS")}</span>
                  </div>
                </div>
                <Button type="button" variant="outline" size="icon" onClick={() => removeSubcategory(index)} disabled={isDelete} aria-label="Remove subcategory">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        {draft.type === "Revenue" && (
          <>
            <InputField disabled={isDelete} label="Reservation ID" value={draft.reservationId || ""} onChange={value => updateDraft({ reservationId: value })} />
            <InputField disabled={isDelete} label="Customer Invoice ID" value={draft.customerInvoiceId || ""} onChange={value => updateDraft({ customerInvoiceId: value })} />
          </>
        )}
        {draft.type === "Expense" && (
          <InputField disabled={isDelete} label="Supplier Invoice ID" value={draft.supplierInvoiceId || ""} onChange={value => updateDraft({ supplierInvoiceId: value })} />
        )}
        <label className="block text-sm font-medium">
          Description
          <textarea
            className="mt-1 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-70"
            value={draft.description || ""}
            onChange={event => updateDraft({ description: event.target.value })}
            disabled={isDelete}
          />
        </label>
        <Button className="w-full" variant={isDelete ? "destructive" : "default"} onClick={onConfirm}>
          {isDelete ? "Confirm Delete from Accountancy" : pendingAction.action === "update" ? "Confirm Update in Accountancy" : "Confirm and Post to Accountancy"}
        </Button>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, type = "text", disabled = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; disabled?: boolean }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <Input className="mt-1" type={type} value={value} onChange={event => onChange(event.target.value)} disabled={disabled} />
    </label>
  );
}

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
      <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function recalculateDraft(entry: Partial<AccountancyEntry>): Partial<AccountancyEntry> {
  const currency = normalizeCurrency(entry.currency);
  const fx = buildDualCurrencyAmounts({
    amount: Number(entry.amount || 0),
    currency,
    fxUsdThs: entry.fxUsdThs,
    fxThsUsd: entry.fxThsUsd,
  });
  const sourceBreakdown = entry.subcategoryBreakdown?.length
    ? entry.subcategoryBreakdown
    : (entry.subcategories || []).map(name => ({ name, amount: 0, amountUsd: 0, amountThs: 0 }));
  const subcategoryBreakdown = (sourceBreakdown.length ? sourceBreakdown : [{ name: "", amount: 0, amountUsd: 0, amountThs: 0 }])
    .map(item => {
      const lineFx = buildDualCurrencyAmounts({
        amount: Number(item.amount || 0),
        currency,
        fxUsdThs: fx.fxUsdThs,
        fxThsUsd: fx.fxThsUsd,
      });
      return {
        name: item.name || "",
        amount: Number(item.amount || 0),
        amountUsd: lineFx.amountUsd,
        amountThs: lineFx.amountThs,
      };
    });

  return {
    ...entry,
    currency,
    amountUsd: fx.amountUsd,
    amountThs: fx.amountThs,
    fxUsdThs: fx.fxUsdThs,
    fxThsUsd: fx.fxThsUsd,
    subcategoryBreakdown,
    subcategories: subcategoryBreakdown.map(item => item.name).filter(Boolean),
  };
}

function normalizeForPosting(draft: Partial<AccountancyEntry>): AccountancyEntry {
  const recalculated = recalculateDraft(draft);
  const subcategoryBreakdown = (recalculated.subcategoryBreakdown || []).filter(item => item.name.trim());

  return normalizeAccountancyEntry({
    id: recalculated.id || "",
    propertyId: recalculated.propertyId || "",
    type: recalculated.type || "Revenue",
    date: recalculated.date || new Date().toISOString().split("T")[0],
    category: getDatedCategoryName(recalculated.category || "", recalculated.date),
    subcategories: subcategoryBreakdown.map(item => item.name.trim()),
    subcategoryBreakdown,
    counterparty: recalculated.counterparty || "",
    description: recalculated.description || "",
    amount: Number(recalculated.amount || 0),
    currency: recalculated.currency || "USD",
    amountUsd: recalculated.amountUsd,
    amountThs: recalculated.amountThs,
    fxUsdThs: recalculated.fxUsdThs,
    fxThsUsd: recalculated.fxThsUsd,
    reservationId: recalculated.reservationId,
    customerInvoiceId: recalculated.customerInvoiceId,
    supplierInvoiceId: recalculated.supplierInvoiceId,
    documentType: recalculated.documentType || "Other",
    paymentMethod: recalculated.paymentMethod,
    reference: recalculated.reference,
    taxAmount: Number(recalculated.taxAmount || 0),
    source: recalculated.source || "GenAI Assistant",
    status: "Confirmed",
    attachmentName: recalculated.attachmentName,
    attachments: recalculated.attachments || [],
    rawSummary: recalculated.rawSummary,
    createdAt: recalculated.createdAt || new Date().toISOString(),
  });
}

function validateSubcategoryTotals(entry: Partial<AccountancyEntry>) {
  const breakdown = (entry.subcategoryBreakdown || []).filter(item => item.name.trim());
  if (!breakdown.length) return "";

  const total = breakdown.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const currency = normalizeCurrency(entry.currency);
  const tolerance = currency === "TZS" ? 1 : 0.01;
  const difference = roundMoney(total - Number(entry.amount || 0), currency === "TZS" ? 0 : 2);
  if (Math.abs(difference) <= tolerance) return "";

  return `Subcategory amounts must equal the invoice total. Current subcategory total is ${formatMoney(total, currency)} and invoice total is ${formatMoney(Number(entry.amount || 0), currency)}. Difference: ${formatMoney(difference, currency)}.`;
}

function resolveTargetEntry(extraction: AssistantExtraction, entries: AccountancyEntry[]) {
  const targetId = extraction.targetEntryId?.trim();
  if (targetId) {
    const exact = entries.find(entry => entry.id.toLowerCase() === targetId.toLowerCase());
    if (exact) return exact;
  }

  const reference = (extraction.targetReference || extraction.reference || "").trim().toLowerCase();
  if (reference) {
    const byReference = entries.find(entry => (entry.reference || "").toLowerCase() === reference || entry.id.toLowerCase() === reference);
    if (byReference) return byReference;
  }

  return entries.find(entry => {
    const sameType = extraction.type === "Unknown" || entry.type === extraction.type;
    const sameCounterparty = extraction.counterparty ? entry.counterparty.toLowerCase().includes(extraction.counterparty.toLowerCase()) : true;
    const sameCategory = extraction.category ? entry.category.toLowerCase().includes(extraction.category.toLowerCase()) : true;
    const sameAmount = extraction.amount ? Math.abs(entry.amount - Number(extraction.amount)) < 0.01 : true;
    return sameType && sameCounterparty && sameCategory && sameAmount;
  });
}

async function fileToPayload(file: File): Promise<UploadPayload> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const [, base64 = ""] = dataUrl.split(",");
  return {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    data: base64,
  };
}
