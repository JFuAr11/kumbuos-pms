import { FormEvent, useMemo, useState } from "react";
import { Bot, FileText, LockKeyhole, Paperclip, Plus, Send, Sparkles, X } from "lucide-react";
import type { AccountancyEntry } from "../../context/AppContext";
import { useAppContext } from "../../context/AppContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { formatMoney } from "../../utils/accountancy";

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
  counterparty?: string;
  description?: string;
  amount?: number;
  currency?: string;
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
  counterparty: "",
  description: "",
  amount: 0,
  currency: "USD",
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
      content: "Upload or describe a supplier invoice, proof of payment, or an accounting change. I will prepare a proposal first. Nothing is posted, edited, or deleted until you confirm it here.",
    },
  ]);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [error, setError] = useState("");

  const recentAiEntries = useMemo(
    () => propertyEntries.filter(entry => entry.source === "GenAI Assistant").slice(0, 5),
    [propertyEntries],
  );

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
            counterparty: entry.counterparty,
            amount: entry.amount,
            currency: entry.currency,
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
        buildPendingAction(data.extraction, data.reply || "", files.map(file => file.name).join(", "));
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

  const buildPendingAction = (extraction: AssistantExtraction, rawSummary: string, attachmentName: string) => {
    const action = extraction.action || "create";
    if (action === "none" || (action === "create" && extraction.type === "Unknown")) {
      setPendingAction(null);
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
    const draft: Partial<AccountancyEntry> = {
      ...base,
      type: extraction.type !== "Unknown" ? extraction.type : base.type,
      date: extraction.date || base.date || emptyDraft.date,
      category: extraction.category || base.category || "",
      subcategories: extraction.subcategories?.length ? extraction.subcategories : base.subcategories || [],
      counterparty: extraction.counterparty || base.counterparty || "",
      description: extraction.description || base.description || "",
      amount: Number(extraction.amount ?? base.amount ?? 0),
      currency: extraction.currency || base.currency || activeProperty?.currency || "USD",
      documentType: extraction.documentType || base.documentType || (extraction.type === "Expense" ? "Supplier Invoice" : "Proof of Payment"),
      paymentMethod: extraction.paymentMethod || base.paymentMethod || "",
      reference: extraction.reference || base.reference || extraction.targetReference || "",
      taxAmount: Number(extraction.taxAmount ?? base.taxAmount ?? 0),
      attachmentName: attachmentName || base.attachmentName,
      rawSummary,
    };

    setPendingAction({
      action,
      targetEntryId: target?.id || extraction.targetEntryId,
      original: target,
      draft,
    });
  };

  const confirmPendingAction = () => {
    if (!pendingAction) return;

    if (pendingAction.action === "delete") {
      if (!pendingAction.targetEntryId || pendingAction.original?.propertyId !== selectedPropertyId) {
        setError("This delete proposal is not valid for the active property.");
        return;
      }
      deleteAccountancyEntry(pendingAction.targetEntryId);
      appendPostedMessage(`Deleted ${pendingAction.original.type.toLowerCase()} entry "${pendingAction.original.category}" from Accountancy. Overview, P&L, and Balance are now updated.`);
      setPendingAction(null);
      setError("");
      return;
    }

    const draft = pendingAction.draft;
    if (!draft.type || !draft.date || !draft.category || !draft.counterparty || !draft.description || !Number(draft.amount)) {
      setError("Complete type, date, category, counterparty, description, and amount before confirming.");
      return;
    }

    const payload: AccountancyEntry = {
      id: pendingAction.targetEntryId || `acc-${Date.now()}`,
      propertyId: selectedPropertyId,
      type: draft.type,
      date: draft.date,
      category: draft.category,
      subcategories: (draft.subcategories || []).map(item => item.trim()).filter(Boolean),
      counterparty: draft.counterparty,
      description: draft.description,
      amount: Number(draft.amount),
      currency: draft.currency || "USD",
      documentType: draft.documentType || "Other",
      paymentMethod: draft.paymentMethod,
      reference: draft.reference,
      taxAmount: Number(draft.taxAmount || 0),
      source: pendingAction.action === "update" ? (pendingAction.original?.source || "GenAI Assistant") : "GenAI Assistant",
      status: "Confirmed",
      attachmentName: draft.attachmentName,
      rawSummary: draft.rawSummary,
      createdAt: pendingAction.original?.createdAt || new Date().toISOString(),
    };

    if (pendingAction.action === "update") {
      const original = pendingAction.original;
      if (!original || original.propertyId !== selectedPropertyId) {
        setError("This update proposal is not valid for the active property.");
        return;
      }
      updateAccountancyEntry(original.id, payload);
      appendPostedMessage(`Updated ${payload.type.toLowerCase()} entry "${payload.category}" for ${formatMoney(payload.amount, payload.currency)}. Revenues, Expenses, P&L, and Balance are now recalculated.`);
    } else {
      addAccountancyEntry(payload);
      appendPostedMessage(`${payload.type} posted to Accountancy for ${formatMoney(payload.amount, payload.currency)}. Revenues, Expenses, P&L, and Balance are now updated.`);
    }

    setPendingAction(null);
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
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Accountancy Intelligence</p>
        <h1 className="text-3xl font-bold">GenAI Assistant</h1>
        <p className="text-muted-foreground">Create, review, modify, or delete accounting ledger entries only after explicit confirmation.</p>
      </div>

      <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm">
        <div className="flex gap-3">
          <LockKeyhole className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold">Accountancy-only guardrail</p>
            <p className="text-muted-foreground">This assistant can only prepare changes for the active property ledger in Accountancy. It cannot change Reservations, Supply Requests, Check-in, Admin Platform, Owner Console, companies, properties, users, or permissions.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
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
                      <p className="text-muted-foreground">{message.extraction.category} - {formatMoney(Number(message.extraction.amount || 0), message.extraction.currency || "USD")}</p>
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
                      {entry.type === "Expense" || entry.type === "Liability" ? "-" : ""}{formatMoney(entry.amount, entry.currency)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{entry.subcategories?.length ? entry.subcategories.join(", ") : "Unassigned subcategory"}</p>
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

  const draft = pendingAction.draft;
  const updateDraft = (updates: Partial<AccountancyEntry>) => setPendingAction({ ...pendingAction, draft: { ...draft, ...updates } });
  const isDelete = pendingAction.action === "delete";
  const subcategories = draft.subcategories?.length ? draft.subcategories : [""];
  const updateSubcategory = (index: number, value: string) => {
    const next = [...subcategories];
    next[index] = value;
    updateDraft({ subcategories: next });
  };
  const addSubcategory = () => updateDraft({ subcategories: [...subcategories, ""] });
  const removeSubcategory = (index: number) => {
    const next = subcategories.filter((_, itemIndex) => itemIndex !== index);
    updateDraft({ subcategories: next.length ? next : [""] });
  };

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
          <p className="text-muted-foreground">{pendingAction.original.id} - {pendingAction.original.category} - {formatMoney(pendingAction.original.amount, pendingAction.original.currency)}</p>
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
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Subcategories</p>
            <Button type="button" variant="outline" size="sm" onClick={addSubcategory} disabled={isDelete}>
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>
          {subcategories.map((subcategory, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={subcategory}
                onChange={event => updateSubcategory(index, event.target.value)}
                placeholder={index === 0 ? "e.g., Carrot, Chicken, Cash, Deposit..." : "Additional subcategory"}
                disabled={isDelete}
              />
              <Button type="button" variant="outline" size="icon" onClick={() => removeSubcategory(index)} disabled={isDelete} aria-label="Remove subcategory">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <InputField disabled={isDelete} label="Counterparty" value={draft.counterparty || ""} onChange={value => updateDraft({ counterparty: value })} />
        <InputField disabled={isDelete} label="Reference" value={draft.reference || ""} onChange={value => updateDraft({ reference: value })} />
        <InputField disabled={isDelete} label="Amount" type="number" value={String(draft.amount || 0)} onChange={value => updateDraft({ amount: Number(value) })} />
        <InputField disabled={isDelete} label="Currency" value={draft.currency || "USD"} onChange={value => updateDraft({ currency: value.toUpperCase() })} />
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
