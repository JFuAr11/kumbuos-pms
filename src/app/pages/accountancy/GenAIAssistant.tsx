import { DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Bot, Database, Download, FileText, LockKeyhole, Paperclip, Plus, Send, Sparkles, X } from "lucide-react";
import type { AccountancyAttachment, AccountancyEntry } from "../../context/AppContext";
import { useAppContext } from "../../context/AppContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  buildDualCurrencyAmounts,
  formatAccountancyLineItem,
  formatDisplayMoney,
  formatMoney,
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
    quantity?: number;
    unit?: string;
    unitPrice?: number;
    lineTotal?: number;
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
  ifrsTreatment?: AccountancyEntry["ifrsTreatment"] | string;
  capitalizationCandidate?: boolean;
  assetUsefulLifeMonths?: number;
  depreciationMethod?: AccountancyEntry["depreciationMethod"] | string;
  ifrsNotes?: string;
  questions?: string[];
  entries?: AssistantExtraction[];
};

type PendingAction = {
  action: Exclude<AssistantAction, "none">;
  mode?: "single" | "financial-baseline";
  targetEntryId?: string;
  original?: AccountancyEntry | null;
  draft: Partial<AccountancyEntry>;
  drafts?: Partial<AccountancyEntry>[];
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
  const [assistantMode, setAssistantMode] = useState<"transactions" | "financial-baseline">("transactions");
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [reviewError, setReviewError] = useState("");

  const recentAiEntries = useMemo(
    () => propertyEntries.filter(entry => entry.source === "GenAI Assistant" || entry.source === "Financial Baseline").slice(0, 8),
    [propertyEntries],
  );

  const addFiles = (incomingFiles: File[]) => {
    if (!incomingFiles.length) return;
    setFiles(current => {
      const existing = new Set(current.map(file => `${file.name}-${file.size}-${file.lastModified}`));
      const next = incomingFiles.filter(file => !existing.has(`${file.name}-${file.size}-${file.lastModified}`));
      return [...current, ...next];
    });
  };

  const removeFile = (index: number) => {
    setFiles(current => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.types.includes("Files")) {
      setIsDragActive(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragActive(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);
    addFiles(Array.from(event.dataTransfer.files || []));
  };

  const exportAssistantPdf = () => {
    const pendingRows = pendingAction?.drafts?.length
      ? pendingAction.drafts.map((draft, index) => ({
        Status: "Pending financial baseline",
        Action: `Batch line ${index + 1}`,
        Type: draft.type || "",
        Date: draft.date || "",
        Category: getDatedCategoryName(draft.category || "Uncategorized", draft.date),
        Counterparty: draft.counterparty || "",
        Reference: draft.reference || "",
        Amount: `${draft.type === "Expense" || draft.type === "Liability" ? "-" : ""}${formatDisplayMoney(getEntryDisplayAmount(draft as AccountancyEntry, accountancyDisplayCurrency), accountancyDisplayCurrency)}`,
        Subcategories: draft.subcategoryBreakdown?.map(item => formatAccountancyLineItem(item, draft.currency || "USD")).join(", ") || "",
      }))
      : pendingAction && pendingAction.action !== "delete"
        ? [{
        Status: "Pending review",
        Action: pendingAction.action,
        Type: pendingAction.draft.type || "",
        Date: pendingAction.draft.date || "",
        Category: getDatedCategoryName(pendingAction.draft.category || "Uncategorized", pendingAction.draft.date),
        Counterparty: pendingAction.draft.counterparty || "",
        Reference: pendingAction.draft.reference || "",
        Amount: `${pendingAction.draft.type === "Expense" || pendingAction.draft.type === "Liability" ? "-" : ""}${formatDisplayMoney(getEntryDisplayAmount(pendingAction.draft as AccountancyEntry, accountancyDisplayCurrency), accountancyDisplayCurrency)}`,
        Subcategories: pendingAction.draft.subcategoryBreakdown?.map(item => formatAccountancyLineItem(item, pendingAction.draft.currency || "USD")).join(", ") || "",
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
      Subcategories: entry.subcategoryBreakdown?.map(item => formatAccountancyLineItem(item, entry.currency)).join(", ") || "",
    }));

    exportToPDF([...pendingRows, ...postedRows], "GenAI-Assistant", "GenAI Assistant - Accountancy");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim() && files.length === 0) return;

    setError("");
    setReviewError("");
    setIsLoading(true);
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: [
        assistantMode === "financial-baseline" ? "Mode: Financial Baseline Setup" : "",
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
          mode: assistantMode,
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
            ifrsTreatment: entry.ifrsTreatment || "",
            capitalizationCandidate: entry.capitalizationCandidate || false,
            assetUsefulLifeMonths: entry.assetUsefulLifeMonths || 0,
            depreciationMethod: entry.depreciationMethod || "",
            ifrsNotes: entry.ifrsNotes || "",
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

  const draftFromExtraction = (
    extraction: AssistantExtraction,
    base: Partial<AccountancyEntry>,
    rawSummary: string,
    attachmentName: string,
  ) => recalculateDraft({
    ...base,
    type: extraction.type !== "Unknown" ? extraction.type : base.type,
    date: extraction.date || base.date || emptyDraft.date,
    category: extraction.category || base.category || "",
    subcategories: extraction.subcategories?.length ? extraction.subcategories : base.subcategories || [],
    subcategoryBreakdown: extraction.subcategoryBreakdown?.length
      ? extraction.subcategoryBreakdown.map(item => ({
        name: item.name,
        quantity: Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : undefined,
        unit: item.unit || "",
        unitPrice: Number.isFinite(Number(item.unitPrice)) ? Number(item.unitPrice) : undefined,
        lineTotal: Number.isFinite(Number(item.lineTotal)) ? Number(item.lineTotal) : undefined,
        amount: Number(item.amount || 0),
        amountUsd: Number(item.amountUsd || 0),
        amountThs: Number(item.amountThs || 0),
      }))
      : base.subcategoryBreakdown || emptyDraft.subcategoryBreakdown,
    counterparty: extraction.counterparty || base.counterparty || (assistantMode === "financial-baseline" ? "Opening Financial Statements" : ""),
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
    documentType: extraction.documentType || base.documentType || (extraction.type === "Expense" ? "Supplier Invoice" : "Other"),
    paymentMethod: extraction.paymentMethod || base.paymentMethod || "",
    reference: extraction.reference || base.reference || (assistantMode === "financial-baseline" ? `Financial baseline ${extraction.date || emptyDraft.date}` : ""),
    taxAmount: Number(extraction.taxAmount ?? base.taxAmount ?? 0),
    attachmentName: attachmentName || base.attachmentName,
    attachments: base.attachments || [],
    rawSummary,
    ifrsTreatment: extraction.ifrsTreatment || base.ifrsTreatment || (assistantMode === "financial-baseline" ? "Manual Adjustment" : ""),
    capitalizationCandidate: Boolean(extraction.capitalizationCandidate ?? base.capitalizationCandidate),
    assetUsefulLifeMonths: Number(extraction.assetUsefulLifeMonths ?? base.assetUsefulLifeMonths ?? 0),
    depreciationMethod: extraction.depreciationMethod || base.depreciationMethod || "",
    ifrsNotes: extraction.ifrsNotes || base.ifrsNotes || (assistantMode === "financial-baseline" ? "Imported from reviewed financial statements as the opening/current baseline for this property." : ""),
  });

  const buildPendingAction = (extraction: AssistantExtraction, rawSummary: string, attachmentName: string, sourceFiles: File[]) => {
    const action = extraction.action || "create";
    const batchEntries = Array.isArray(extraction.entries)
      ? extraction.entries.filter(entry => entry.type !== "Unknown" && entry.category && Number(entry.amount))
      : [];

    if (action === "create" && batchEntries.length) {
      const drafts = batchEntries.map(entry => draftFromExtraction(entry, emptyDraft, rawSummary, attachmentName));
      setPendingFiles(sourceFiles);
      setPendingAction({
        action: "create",
        mode: "financial-baseline",
        draft: drafts[0],
        drafts,
      });
      return;
    }

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
    const draft = draftFromExtraction(extraction, base, rawSummary, attachmentName);

    setPendingFiles(sourceFiles);
    setPendingAction({
      action,
      mode: "single",
      targetEntryId: target?.id || extraction.targetEntryId,
      original: target,
      draft,
    });
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    if (!selectedPropertyId) {
      setReviewError("Select an active property before posting to Accountancy.");
      return;
    }

    setError("");
    setReviewError("");
    setIsPosting(true);

    try {
      if (pendingAction.mode === "financial-baseline" && pendingAction.drafts?.length) {
        const preparedDrafts = pendingAction.drafts.map(draft => balanceSubcategoryTotals(recalculateDraft(draft)));
        const missingIndex = preparedDrafts.findIndex(draft => !draft.type || !draft.date || !draft.category || !draft.description || !Number(draft.amount));
        if (missingIndex >= 0) {
          setReviewError(`Baseline line ${missingIndex + 1} is missing type, date, category, description, or amount.`);
          return;
        }
        const subcategoryErrors = preparedDrafts
          .map((draft, index) => ({ index, error: validateSubcategoryTotals(draft) }))
          .filter(item => item.error);
        if (subcategoryErrors.length) {
          setReviewError(`Baseline line ${subcategoryErrors[0].index + 1}: ${subcategoryErrors[0].error}`);
          return;
        }

        const batchId = `baseline-${Date.now()}`;
        let uploadedAttachments: AccountancyAttachment[] = [];
        if (pendingFiles.length) {
          try {
            uploadedAttachments = await uploadAccountancyAttachments({
              propertyId: selectedPropertyId,
              entryId: batchId,
              files: pendingFiles,
              source: "Financial Baseline",
            });
          } catch (error) {
            setReviewError(error instanceof Error ? error.message : "Could not upload the baseline source documents. Nothing was posted.");
            return;
          }
        }

        const payloads = preparedDrafts.map((draft, index) => {
          const normalizedDraft = normalizeForPosting(draft);
          return {
            id: `acc-${Date.now()}-${index}`,
            propertyId: selectedPropertyId,
            type: normalizedDraft.type,
            date: normalizedDraft.date,
            category: normalizedDraft.category,
            subcategories: normalizedDraft.subcategories || [],
            subcategoryBreakdown: normalizedDraft.subcategoryBreakdown || [],
            counterparty: normalizedDraft.counterparty || "Opening Financial Statements",
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
            reference: normalizedDraft.reference || batchId,
            taxAmount: Number(normalizedDraft.taxAmount || 0),
            source: "Financial Baseline" as const,
            status: "Confirmed" as const,
            attachments: uploadedAttachments,
            attachmentName: uploadedAttachments.length ? uploadedAttachments.map(item => item.name).join(", ") : normalizedDraft.attachmentName,
            rawSummary: normalizedDraft.rawSummary,
            ifrsTreatment: normalizedDraft.ifrsTreatment,
            capitalizationCandidate: normalizedDraft.capitalizationCandidate,
            assetUsefulLifeMonths: normalizedDraft.assetUsefulLifeMonths,
            depreciationMethod: normalizedDraft.depreciationMethod,
            depreciationStartDate: normalizedDraft.depreciationStartDate,
            assetResidualValue: normalizedDraft.assetResidualValue,
            linkedAssetEntryId: normalizedDraft.linkedAssetEntryId,
            ifrsNotes: normalizedDraft.ifrsNotes,
            createdAt: new Date().toISOString(),
          } satisfies AccountancyEntry;
        });

        payloads.forEach(addAccountancyEntry);
        appendPostedMessage(`Financial baseline posted with ${payloads.length} confirmed ledger entries. Revenues and Expenses now feed P&L; Assets and Liabilities now feed Balance; Overview is recalculated from both.`);
        setPendingAction(null);
        setPendingFiles([]);
        setError("");
        setReviewError("");
        return;
      }

      if (pendingAction.action === "delete") {
        if (!pendingAction.targetEntryId || pendingAction.original?.propertyId !== selectedPropertyId) {
          setReviewError("This delete proposal is not valid for the active property.");
          return;
        }
        deleteAccountancyEntry(pendingAction.targetEntryId);
        appendPostedMessage(`Deleted ${pendingAction.original.type.toLowerCase()} entry "${getDatedCategoryName(pendingAction.original.category, pendingAction.original.date)}" from Accountancy. ${statementImpact(pendingAction.original.type)} and Overview are now updated.`);
        setPendingAction(null);
        setPendingFiles([]);
        setReviewError("");
        return;
      }

      const draft = balanceSubcategoryTotals(recalculateDraft(pendingAction.draft));
      if (!draft.type || !draft.date || !draft.category || !draft.counterparty || !draft.description || !Number(draft.amount)) {
        setReviewError("Complete type, date, category, counterparty, description, and amount before confirming.");
        return;
      }
      const subcategoryError = validateSubcategoryTotals(draft);
      if (subcategoryError) {
        setReviewError(subcategoryError);
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
          setReviewError(error instanceof Error ? error.message : "Could not upload the source documents. Nothing was posted.");
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
        ifrsTreatment: normalizedDraft.ifrsTreatment,
        capitalizationCandidate: normalizedDraft.capitalizationCandidate,
        assetUsefulLifeMonths: normalizedDraft.assetUsefulLifeMonths,
        depreciationMethod: normalizedDraft.depreciationMethod,
        depreciationStartDate: normalizedDraft.depreciationStartDate,
        assetResidualValue: normalizedDraft.assetResidualValue,
        linkedAssetEntryId: normalizedDraft.linkedAssetEntryId,
        ifrsNotes: normalizedDraft.ifrsNotes,
        createdAt: pendingAction.original?.createdAt || new Date().toISOString(),
      };

      if (pendingAction.action === "update") {
        const original = pendingAction.original;
        if (!original || original.propertyId !== selectedPropertyId) {
          setReviewError("This update proposal is not valid for the active property.");
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
      setReviewError("");
    } finally {
      setIsPosting(false);
    }
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

      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          className={`rounded-xl border p-4 text-left shadow-sm transition hover:border-primary/60 ${
            assistantMode === "transactions" ? "border-primary bg-primary/10" : "border-border bg-card"
          }`}
          onClick={() => setAssistantMode("transactions")}
        >
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold">Document Chat</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Read invoices, proof of payment, and individual accounting changes. One proposal is prepared for review.
              </p>
            </div>
          </div>
        </button>
        <button
          type="button"
          className={`rounded-xl border p-4 text-left shadow-sm transition hover:border-primary/60 ${
            assistantMode === "financial-baseline" ? "border-primary bg-primary/10" : "border-border bg-card"
          }`}
          onClick={() => setAssistantMode("financial-baseline")}
        >
          <div className="flex items-start gap-3">
            <Database className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold">Financial Baseline Setup</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload current P&L and Balance statements so Gemini can prepare the full opening/current ledger position for this property.
              </p>
            </div>
          </div>
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_560px] 2xl:grid-cols-[minmax(0,1fr)_620px]">
        <div
          className={`relative overflow-hidden rounded-xl border bg-card shadow-sm transition ${isDragActive ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragActive && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-primary/10 backdrop-blur-[1px]">
              <div className="rounded-lg border border-primary/40 bg-card px-5 py-4 text-center text-sm font-semibold text-primary shadow-lg">
                Drop invoice or proof-of-payment files here
              </div>
            </div>
          )}
          <div className="border-b border-border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">{assistantMode === "financial-baseline" ? "Financial Baseline Setup" : "Document Chat"}</h2>
                <p className="text-sm text-muted-foreground">
                  {assistantMode === "financial-baseline" ? "Financial Baseline Setup" : "Active property"}: {activeProperty?.name || "No property selected"}
                </p>
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
                  {message.extraction && (message.extraction.type !== "Unknown" || Boolean(message.extraction.entries?.length)) && (
                    <div className="mt-3 rounded-md border border-border bg-card p-3 text-foreground">
                      {message.extraction.entries?.length ? (
                        <>
                          <p className="font-semibold">FINANCIAL BASELINE proposal</p>
                          <p className="text-muted-foreground">{message.extraction.entries.length} P&L / Balance lines prepared for review.</p>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold">{(message.extraction.action || "create").toUpperCase()} proposal</p>
                          <p className="text-muted-foreground">{getDatedCategoryName(message.extraction.category || "Uncategorized", message.extraction.date)} - {formatMoney(Number(message.extraction.amount || 0), message.extraction.currency || "USD")}</p>
                        </>
                      )}
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
              {files.map((file, index) => (
                <span key={`${file.name}-${file.size}-${index}`} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1 text-xs">
                  <FileText className="h-3.5 w-3.5" />
                  {file.name}
                  <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}>
                    <X className="h-3.5 w-3.5" />
                  </button>
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
                  onChange={event => {
                    addFiles(Array.from(event.target.files || []));
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <Input
                className="min-h-10 flex-1"
                value={input}
                onChange={event => setInput(event.target.value)}
                placeholder={assistantMode === "financial-baseline"
                  ? "Tell Gemini the statement date and upload P&L + Balance files..."
                  : "Ask Gemini to create, edit, or delete an Accountancy entry..."}
              />
              <Button type="submit" disabled={isLoading}>
                <Send className="mr-2 h-4 w-4" />
                Send
              </Button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <ReviewPanel
            pendingAction={pendingAction}
            setPendingAction={setPendingAction}
            onConfirm={confirmPendingAction}
            error={reviewError}
            isPosting={isPosting}
            pendingFiles={pendingFiles}
          />
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
                      ? entry.subcategoryBreakdown.map(item => formatAccountancyLineItem(item, entry.currency)).join(", ")
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
  error,
  isPosting,
  pendingFiles,
}: {
  pendingAction: PendingAction | null;
  setPendingAction: (action: PendingAction | null) => void;
  onConfirm: () => void;
  error: string;
  isPosting: boolean;
  pendingFiles: File[];
}) {
  if (!pendingAction) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">Review & Confirm</h2>
        <p className="mt-2 text-sm text-muted-foreground">The proposed create, update, or delete action will appear here. No Accountancy changes happen without confirmation.</p>
      </div>
    );
  }

  if (pendingAction.mode === "financial-baseline" && pendingAction.drafts?.length) {
    return (
      <BaselineBatchReviewPanel
        pendingAction={pendingAction}
        setPendingAction={setPendingAction}
        onConfirm={onConfirm}
        error={error}
        isPosting={isPosting}
        pendingFiles={pendingFiles}
      />
    );
  }

  return <ActiveReviewPanel pendingAction={pendingAction} setPendingAction={setPendingAction} onConfirm={onConfirm} error={error} isPosting={isPosting} pendingFiles={pendingFiles} />;
}

function BaselineBatchReviewPanel({
  pendingAction,
  setPendingAction,
  onConfirm,
  error,
  isPosting,
  pendingFiles,
}: {
  pendingAction: PendingAction;
  setPendingAction: (action: PendingAction | null) => void;
  onConfirm: () => void;
  error: string;
  isPosting: boolean;
  pendingFiles: File[];
}) {
  const { accountancyDisplayCurrency } = useAppContext();
  const drafts = (pendingAction.drafts || []).map(recalculateDraft);
  const totals = drafts.reduce((acc, draft) => {
    const type = draft.type || "Revenue";
    const amount = getEntryDisplayAmount(draft as AccountancyEntry, accountancyDisplayCurrency);
    acc[type] = (acc[type] || 0) + amount;
    return acc;
  }, {} as Record<AccountancyEntry["type"], number>);

  const updateDraftAt = (index: number, updates: Partial<AccountancyEntry>) => {
    const next = drafts.map((draft, itemIndex) => itemIndex === index ? recalculateDraft({ ...draft, ...updates }) : draft);
    setPendingAction({ ...pendingAction, draft: next[0], drafts: next });
  };

  const removeDraftAt = (index: number) => {
    const next = drafts.filter((_, itemIndex) => itemIndex !== index);
    if (!next.length) {
      setPendingAction(null);
      return;
    }
    setPendingAction({ ...pendingAction, draft: next[0], drafts: next });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Financial Baseline Review</h2>
          <p className="text-xs uppercase tracking-wider text-primary">{drafts.length} statement lines ready for confirmation</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPendingAction(null)}>Clear</Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <ReadOnlyValue label="Revenue" value={formatDisplayMoney(totals.Revenue || 0, accountancyDisplayCurrency)} />
        <ReadOnlyValue label="Expenses" value={`-${formatDisplayMoney(totals.Expense || 0, accountancyDisplayCurrency)}`} />
        <ReadOnlyValue label="Assets" value={formatDisplayMoney(totals.Asset || 0, accountancyDisplayCurrency)} />
        <ReadOnlyValue label="Liabilities" value={`-${formatDisplayMoney(totals.Liability || 0, accountancyDisplayCurrency)}`} />
      </div>

      <div className="mt-4 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-muted-foreground">
        Confirming this baseline will create confirmed ledger entries. Revenue and Expense lines feed P&L; Asset and Liability lines feed Balance; Overview recalculates from both.
      </div>

      <div className="mt-4 max-h-[620px] space-y-3 overflow-y-auto pr-1">
        {drafts.map((draft, index) => (
          <div key={`${draft.category}-${index}`} className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Statement line {index + 1}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => removeDraftAt(index)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <label className="block text-sm font-medium">
              Type
              <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.type || "Revenue"} onChange={event => updateDraftAt(index, { type: event.target.value as AccountancyEntry["type"] })}>
                <option value="Revenue">Revenue</option>
                <option value="Expense">Expense</option>
                <option value="Asset">Asset</option>
                <option value="Liability">Liability</option>
              </select>
            </label>
            <InputField label="Date" type="date" value={draft.date || ""} onChange={value => updateDraftAt(index, { date: value })} />
            <InputField label="Category" value={draft.category || ""} onChange={value => updateDraftAt(index, { category: value })} />
            <InputField label="Counterparty / Source" value={draft.counterparty || ""} onChange={value => updateDraftAt(index, { counterparty: value })} />
            <div className="grid gap-2 sm:grid-cols-2">
              <InputField label="Amount" type="number" value={String(draft.amount || 0)} onChange={value => updateDraftAt(index, { amount: Number(value) })} />
              <label className="block text-sm font-medium">
                Currency
                <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={normalizeCurrency(draft.currency)} onChange={event => updateDraftAt(index, { currency: event.target.value })}>
                  <option value="USD">USD</option>
                  <option value="TZS">TZS</option>
                </select>
              </label>
            </div>
            <ReadOnlyValue label="Statement impact" value={`${draft.type === "Expense" || draft.type === "Liability" ? "-" : ""}${formatDisplayMoney(getEntryDisplayAmount(draft as AccountancyEntry, accountancyDisplayCurrency), accountancyDisplayCurrency)}`} />
            <InputField label="Reference" value={draft.reference || ""} onChange={value => updateDraftAt(index, { reference: value })} />
            <label className="block text-sm font-medium">
              IFRS Notes
              <textarea
                className="mt-1 min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={draft.ifrsNotes || ""}
                onChange={event => updateDraftAt(index, { ifrsNotes: event.target.value })}
              />
            </label>
          </div>
        ))}
      </div>

      {pendingFiles.length > 0 && (
        <div className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-sm">
          <p className="font-medium">Baseline source documents</p>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            {pendingFiles.map(file => (
              <p key={`${file.name}-${file.size}`}>{file.name} ({formatFileSize(file.size)})</p>
            ))}
          </div>
        </div>
      )}

      <Button className="mt-4 w-full" onClick={onConfirm} disabled={isPosting}>
        {isPosting ? "Posting baseline..." : "Confirm and Build Accountancy Baseline"}
      </Button>
      {error && <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
    </div>
  );
}

function ActiveReviewPanel({
  pendingAction,
  setPendingAction,
  onConfirm,
  error,
  isPosting,
  pendingFiles,
}: {
  pendingAction: PendingAction;
  setPendingAction: (action: PendingAction | null) => void;
  onConfirm: () => void;
  error: string;
  isPosting: boolean;
  pendingFiles: File[];
}) {
  const { accountancyDisplayCurrency } = useAppContext();
  const draft = recalculateDraft(pendingAction.draft);
  const updateDraft = (updates: Partial<AccountancyEntry>) => setPendingAction({ ...pendingAction, draft: recalculateDraft({ ...draft, ...updates }) });
  const [fxStatus, setFxStatus] = useState("");
  const isDelete = pendingAction.action === "delete";
  const subcategoryBreakdown = draft.subcategoryBreakdown?.length ? draft.subcategoryBreakdown : [{ name: "", amount: 0, amountUsd: 0, amountThs: 0, lineTotal: 0 }];
  const subcategoryTotal = subcategoryBreakdown.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const displayTotal = draft.type === "Expense" || draft.type === "Liability"
    ? -getEntryDisplayAmount(draft as AccountancyEntry, accountancyDisplayCurrency)
    : getEntryDisplayAmount(draft as AccountancyEntry, accountancyDisplayCurrency);
  const updateSubcategory = (index: number, updates: Partial<NonNullable<AccountancyEntry["subcategoryBreakdown"]>[number]>) => {
    const next = [...subcategoryBreakdown];
    const candidate = { ...next[index], ...updates };
    const quantity = Number(candidate.quantity || 0);
    const unitPrice = Number(candidate.unitPrice || 0);
    if ((updates.quantity !== undefined || updates.unitPrice !== undefined) && quantity && unitPrice) {
      candidate.lineTotal = roundMoney(quantity * unitPrice, normalizeCurrency(draft.currency) === "TZS" ? 0 : 2);
      candidate.amount = candidate.lineTotal;
    }
    if (updates.lineTotal !== undefined && updates.amount === undefined) {
      candidate.amount = Number(updates.lineTotal || 0);
    }
    next[index] = candidate;
    updateDraft({
      subcategoryBreakdown: next,
      subcategories: next.map(item => item.name).filter(Boolean),
    });
  };
  const addSubcategory = () => updateDraft({ subcategoryBreakdown: [...subcategoryBreakdown, { name: "", amount: 0, amountUsd: 0, amountThs: 0, lineTotal: 0 }] });
  const removeSubcategory = (index: number) => {
    const next = subcategoryBreakdown.filter((_, itemIndex) => itemIndex !== index);
    updateDraft({
      subcategoryBreakdown: next.length ? next : [{ name: "", amount: 0, amountUsd: 0, amountThs: 0, lineTotal: 0 }],
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
        <label className="block text-sm font-medium">
          IFRS Treatment
          <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.ifrsTreatment || ""} onChange={event => updateDraft({ ifrsTreatment: event.target.value as AccountancyEntry["ifrsTreatment"] })} disabled={isDelete}>
            <option value="">Select treatment</option>
            <option value="Operating Expense">Operating Expense</option>
            <option value="Inventory">Inventory</option>
            <option value="PPE Capitalization">PPE Capitalization</option>
            <option value="PPE Depreciation">PPE Depreciation</option>
            <option value="Intangible Amortization">Intangible Amortization</option>
            <option value="Revenue Recognition">Revenue Recognition</option>
            <option value="Liability Recognition">Liability Recognition</option>
            <option value="Prepayment">Prepayment</option>
            <option value="Manual Adjustment">Manual Adjustment</option>
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(draft.capitalizationCandidate)}
            onChange={event => updateDraft({ capitalizationCandidate: event.target.checked })}
            disabled={isDelete}
          />
          Capitalization candidate
        </label>
        <InputField disabled={isDelete} label="Useful Life (months)" type="number" value={String(draft.assetUsefulLifeMonths || 0)} onChange={value => updateDraft({ assetUsefulLifeMonths: Number(value) })} />
        <label className="block text-sm font-medium">
          IFRS Notes
          <textarea
            className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-70"
            value={draft.ifrsNotes || ""}
            onChange={event => updateDraft({ ifrsNotes: event.target.value })}
            disabled={isDelete}
          />
        </label>
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
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Quantity
                  <Input
                    className="mt-1"
                    type="number"
                    value={String(subcategory.quantity || "")}
                    onChange={event => updateSubcategory(index, { quantity: Number(event.target.value) })}
                    placeholder="Quantity"
                    disabled={isDelete}
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Unit
                  <Input
                    className="mt-1"
                    value={subcategory.unit || ""}
                    onChange={event => updateSubcategory(index, { unit: event.target.value })}
                    placeholder="pcs, kg, box..."
                    disabled={isDelete}
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Unit price
                  <Input
                    className="mt-1"
                    type="number"
                    value={String(subcategory.unitPrice || "")}
                    onChange={event => updateSubcategory(index, { unitPrice: Number(event.target.value) })}
                    placeholder="Unit price"
                    disabled={isDelete}
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Line total
                  <Input
                    className="mt-1"
                    type="number"
                    value={String(subcategory.lineTotal ?? subcategory.amount ?? 0)}
                    onChange={event => updateSubcategory(index, { lineTotal: Number(event.target.value), amount: Number(event.target.value) })}
                    placeholder="Quantity x unit price"
                    disabled={isDelete}
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Invoice allocation
                  <Input
                    className="mt-1"
                    type="number"
                    value={String(subcategory.amount || 0)}
                    onChange={event => updateSubcategory(index, { amount: Number(event.target.value) })}
                    placeholder="Amount"
                    disabled={isDelete}
                  />
                </label>
                <div className="space-y-2 rounded-md bg-background px-3 py-2 text-xs sm:col-span-2">
                  <div>
                    <span className="block text-muted-foreground">USD</span>
                    <span className="font-semibold">{formatMoney(subcategory.amountUsd || 0, "USD")}</span>
                  </div>
                  <div>
                    <span className="block text-muted-foreground">TZS</span>
                    <span className="font-semibold">{formatMoney(subcategory.amountThs || 0, "TZS")}</span>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => removeSubcategory(index)} disabled={isDelete} aria-label="Remove subcategory">
                  <X className="h-4 w-4" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
        {pendingFiles.length > 0 && (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            <p className="font-medium">Source documents to attach</p>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              {pendingFiles.map(file => (
                <p key={`${file.name}-${file.size}`}>{file.name} ({formatFileSize(file.size)})</p>
              ))}
            </div>
          </div>
        )}
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
        <Button className="w-full" variant={isDelete ? "destructive" : "default"} onClick={onConfirm} disabled={isPosting}>
          {isPosting ? "Posting..." : isDelete ? "Confirm Delete from Accountancy" : pendingAction.action === "update" ? "Confirm Update in Accountancy" : "Confirm and Post to Accountancy"}
        </Button>
        {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
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
    : (entry.subcategories || []).map(name => ({ name, amount: 0, amountUsd: 0, amountThs: 0, lineTotal: 0 }));
  const subcategoryBreakdown = (sourceBreakdown.length ? sourceBreakdown : [{ name: "", amount: 0, amountUsd: 0, amountThs: 0, lineTotal: 0 }])
    .map(item => {
      const quantity = Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : undefined;
      const unitPrice = Number.isFinite(Number(item.unitPrice)) ? Number(item.unitPrice) : undefined;
      const computedLineTotal = quantity && unitPrice ? roundMoney(quantity * unitPrice, currency === "TZS" ? 0 : 2) : undefined;
      const lineTotal = Number.isFinite(Number(item.lineTotal)) ? Number(item.lineTotal) : computedLineTotal;
      const amount = Number.isFinite(Number(item.amount)) ? Number(item.amount) : Number(lineTotal || 0);
      const lineFx = buildDualCurrencyAmounts({
        amount,
        currency,
        fxUsdThs: fx.fxUsdThs,
        fxThsUsd: fx.fxThsUsd,
      });
      const unitFx = unitPrice !== undefined ? buildDualCurrencyAmounts({
        amount: unitPrice,
        currency,
        fxUsdThs: fx.fxUsdThs,
        fxThsUsd: fx.fxThsUsd,
      }) : null;
      const lineTotalFx = Number.isFinite(Number(lineTotal)) ? buildDualCurrencyAmounts({
        amount: Number(lineTotal),
        currency,
        fxUsdThs: fx.fxUsdThs,
        fxThsUsd: fx.fxThsUsd,
      }) : lineFx;
      return {
        name: item.name || "",
        quantity,
        unit: item.unit || "",
        unitPrice,
        lineTotal: Number.isFinite(Number(lineTotal)) ? Number(lineTotal) : amount,
        amount,
        amountUsd: lineFx.amountUsd,
        amountThs: lineFx.amountThs,
        unitPriceUsd: unitFx?.amountUsd,
        unitPriceThs: unitFx?.amountThs,
        lineTotalUsd: lineTotalFx.amountUsd,
        lineTotalThs: lineTotalFx.amountThs,
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
    ifrsTreatment: entry.ifrsTreatment,
    capitalizationCandidate: entry.capitalizationCandidate,
    assetUsefulLifeMonths: entry.assetUsefulLifeMonths,
    depreciationMethod: entry.depreciationMethod,
    depreciationStartDate: entry.depreciationStartDate,
    assetResidualValue: entry.assetResidualValue,
    linkedAssetEntryId: entry.linkedAssetEntryId,
    ifrsNotes: entry.ifrsNotes,
  };
}

function normalizeForPosting(draft: Partial<AccountancyEntry>): AccountancyEntry {
  const recalculated = balanceSubcategoryTotals(recalculateDraft(draft));
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
    ifrsTreatment: recalculated.ifrsTreatment,
    capitalizationCandidate: recalculated.capitalizationCandidate,
    assetUsefulLifeMonths: recalculated.assetUsefulLifeMonths,
    depreciationMethod: recalculated.depreciationMethod,
    depreciationStartDate: recalculated.depreciationStartDate,
    assetResidualValue: recalculated.assetResidualValue,
    linkedAssetEntryId: recalculated.linkedAssetEntryId,
    ifrsNotes: recalculated.ifrsNotes,
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

function balanceSubcategoryTotals(entry: Partial<AccountancyEntry>) {
  const breakdown = (entry.subcategoryBreakdown || []).filter(item => item.name.trim());
  if (!breakdown.length) return entry;

  const currency = normalizeCurrency(entry.currency);
  const digits = currency === "TZS" ? 0 : 2;
  const total = breakdown.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const difference = roundMoney(Number(entry.amount || 0) - total, digits);
  const tolerance = currency === "TZS" ? 1 : 0.01;
  if (Math.abs(difference) <= tolerance) return entry;

  const adjustmentName = "Tax, rounding, or unallocated adjustment";
  const existingIndex = breakdown.findIndex(item => item.name === adjustmentName);
  const nextBreakdown = [...breakdown];
  if (existingIndex >= 0) {
    nextBreakdown[existingIndex] = {
      ...nextBreakdown[existingIndex],
      amount: roundMoney(Number(nextBreakdown[existingIndex].amount || 0) + difference, digits),
      lineTotal: roundMoney(Number(nextBreakdown[existingIndex].lineTotal || 0) + difference, digits),
    };
  } else {
    nextBreakdown.push({
      name: adjustmentName,
      amount: difference,
      lineTotal: difference,
      amountUsd: 0,
      amountThs: 0,
    });
  }

  return recalculateDraft({
    ...entry,
    subcategoryBreakdown: nextBreakdown,
    subcategories: nextBreakdown.map(item => item.name).filter(Boolean),
  });
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

function formatFileSize(size: number) {
  if (!size) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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
