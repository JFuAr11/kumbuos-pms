import { useEffect, useMemo, useState } from "react";
import { Download, Edit, FileText, Paperclip, Plus, Trash2, X } from "lucide-react";
import type { AccountancyAttachment, AccountancyEntry } from "../../context/AppContext";
import { useAppContext } from "../../context/AppContext";
import { AccountancyDateRangeFilter } from "./AccountancyDateRangeFilter";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  buildDualCurrencyAmounts,
  filterEntriesByDateRange,
  formatAccountancyLineItem,
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

type LedgerFilter = AccountancyEntry["type"] | "All";
type SubcategoryLine = NonNullable<AccountancyEntry["subcategoryBreakdown"]>[number];

const categoryOptions: Record<AccountancyEntry["type"], string[]> = {
  Revenue: [
    "Accommodation Revenue",
    "Food & Beverage Revenue",
    "Activities Revenue",
    "OTA Payments",
    "Direct Client Payments",
    "Agency Payments",
    "Tour Operator Payments",
  ],
  Expense: [
    "Food Supply",
    "Beverage Supply",
    "Housekeeping",
    "Maintenance",
    "Fuel",
    "Payroll",
    "Utilities",
    "Marketing",
    "Bank Fees",
    "Taxes",
    "Depreciation & Amortization",
  ],
  Asset: [
    "Cash and Bank",
    "Accounts Receivable",
    "Inventory",
    "Fixed Assets",
    "Capital Improvements",
    "Accumulated Depreciation",
    "Accumulated Amortization",
    "Prepayments",
  ],
  Liability: [
    "Accounts Payable",
    "Customer Deposits",
    "Taxes Payable",
    "Loans",
    "Accruals",
  ],
};

const blankEntry = (propertyId: string, type: AccountancyEntry["type"]): AccountancyEntry => {
  const fx = buildDualCurrencyAmounts({ amount: 0, currency: "USD" });
  return {
    id: `acc-${Date.now()}`,
    propertyId,
    type,
    date: new Date().toISOString().split("T")[0],
    category: "",
    subcategories: [""],
    subcategoryBreakdown: [{ name: "", amount: 0, amountUsd: 0, amountThs: 0, lineTotal: 0 }],
    counterparty: "",
    description: "",
    amount: 0,
    currency: "USD",
    amountUsd: fx.amountUsd,
    amountThs: fx.amountThs,
    fxUsdThs: fx.fxUsdThs,
    fxThsUsd: fx.fxThsUsd,
    reservationId: "",
    customerInvoiceId: "",
    supplierInvoiceId: "",
    documentType: "Other",
    paymentMethod: "",
    reference: "",
    taxAmount: 0,
    source: "Manual",
    status: "Confirmed",
    attachments: [],
    createdAt: new Date().toISOString(),
  };
};

export function AccountancyLedgerManager({
  title = "Manual Accountancy Ledger",
  filter = "All",
  allowedTypes,
}: {
  title?: string;
  filter?: LedgerFilter;
  allowedTypes?: AccountancyEntry["type"][];
}) {
  const {
    selectedPropertyId,
    accountancyEntries,
    addAccountancyEntry,
    updateAccountancyEntry,
    deleteAccountancyEntry,
    accountancyDisplayCurrency,
  } = useAppContext();
  const availableTypes = allowedTypes?.length
    ? allowedTypes
    : filter === "All"
      ? (["Revenue", "Expense", "Asset", "Liability"] as AccountancyEntry["type"][])
      : [filter];
  const defaultType: AccountancyEntry["type"] = availableTypes[0] || "Revenue";
  const [editing, setEditing] = useState<AccountancyEntry | null>(null);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [dateRange, setDateRange] = useState(getDefaultAccountancyDateRange);
  const [fxStatus, setFxStatus] = useState("");

  const entries = filterEntriesByDateRange(
    accountancyEntries
      .filter(entry => entry.propertyId === selectedPropertyId)
      .filter(entry => availableTypes.includes(entry.type)),
    dateRange,
  )
    .map(normalizeAccountancyEntry)
    .sort((a, b) => b.date.localeCompare(a.date));

  const currentCategoryOptions = useMemo(
    () => categoryOptions[(editing?.type || defaultType) as AccountancyEntry["type"]],
    [editing?.type, defaultType],
  );
  const scopeDescription = availableTypes.every(type => type === "Revenue" || type === "Expense")
    ? "Manual entries are scoped only to the active property and feed Revenues, Expenses, and Profit & Loss."
    : availableTypes.every(type => type === "Asset" || type === "Liability")
      ? "Manual entries are scoped only to the active property and feed Assets, Liabilities, and Balance."
      : "Manual entries are scoped only to the active property and feed the relevant Accountancy statements.";

  const exportLedgerPdf = () => {
    const rows = entries.map(entry => {
      const negative = entry.type === "Expense" || entry.type === "Liability";
      return {
        Date: entry.date,
        Type: entry.type,
        Category: getDatedCategoryName(entry.category, entry.date),
        Subcategories: entry.subcategoryBreakdown?.length
          ? entry.subcategoryBreakdown.map(item => formatAccountancyLineItem(item, entry.currency)).join(", ")
          : "Unassigned",
        Traceability: formatTraceability(entry),
        Counterparty: entry.counterparty,
        Reference: entry.reference || "",
        Amount: `${negative ? "-" : ""}${formatDisplayMoney(getEntryDisplayAmount(entry, accountancyDisplayCurrency), accountancyDisplayCurrency)}`,
        Currency: entry.currency,
        FX_USD_TZS: Number(entry.fxUsdThs || 0).toFixed(6),
        FX_TZS_USD: Number(entry.fxThsUsd || 0).toFixed(8),
      };
    });
    exportToPDF(rows, title.replace(/[^a-z0-9]+/gi, "-"), `${title} - Accountancy`);
  };

  const startNew = () => {
    setAttachmentFiles([]);
    setEditing(blankEntry(selectedPropertyId, defaultType));
  };

  useEffect(() => {
    if (!editing?.date) return;
    let cancelled = false;

    fetchFxRateForDate(editing.date).then(rate => {
      if (cancelled) return;
      setEditing(current => {
        if (!current || current.date !== editing.date) return current;
        return recalculateEditing({
          ...current,
          fxUsdThs: rate.fxUsdThs,
          fxThsUsd: rate.fxThsUsd,
        });
      });
      setFxStatus(`FX loaded from ${rate.source} for ${rate.rateDate}.`);
    });

    return () => {
      cancelled = true;
    };
  }, [editing?.date]);

  const saveEntry = async () => {
    if (!editing) return;
    if (!editing.date || !editing.category || !editing.counterparty || !editing.description || !Number(editing.amount)) {
      alert("Complete date, category, counterparty, description, and amount.");
      return;
    }

    const normalized = normalizeBeforeSave(editing, selectedPropertyId);
    const subcategoryError = validateSubcategoryTotals(normalized);
    if (subcategoryError) {
      alert(subcategoryError);
      return;
    }

    const entryId = normalized.id || `acc-${Date.now()}`;
    let uploadedAttachments: AccountancyAttachment[] = [];
    if (attachmentFiles.length) {
      try {
        uploadedAttachments = await uploadAccountancyAttachments({
          propertyId: selectedPropertyId,
          entryId,
          files: attachmentFiles,
          source: "Manual",
        });
      } catch (error) {
        alert(error instanceof Error ? error.message : "Could not upload accountancy documents.");
        return;
      }
    }

    const attachments = [...(normalized.attachments || []), ...uploadedAttachments];
    const payload = {
      ...normalized,
      id: entryId,
      attachments,
      attachmentName: attachments.length ? attachments.map(item => item.name).join(", ") : normalized.attachmentName,
    };

    if (accountancyEntries.some(entry => entry.id === entryId)) {
      updateAccountancyEntry(entryId, payload);
    } else {
      addAccountancyEntry(payload);
    }
    setAttachmentFiles([]);
    setEditing(null);
  };

  const removeEntry = (entry: AccountancyEntry) => {
    if (confirm(`Delete ${entry.type.toLowerCase()} entry "${getDatedCategoryName(entry.category, entry.date)}" for ${formatDisplayMoney(getEntryDisplayAmount(entry, accountancyDisplayCurrency), accountancyDisplayCurrency)}?`)) {
      deleteAccountancyEntry(entry.id);
    }
  };

  const updateEditing = (updates: Partial<AccountancyEntry>) => {
    if (!editing) return;
    setEditing(recalculateEditing({ ...editing, ...updates }));
  };

  const subcategoryBreakdown = editing?.subcategoryBreakdown?.length
    ? editing.subcategoryBreakdown
    : [{ name: "", amount: 0, amountUsd: 0, amountThs: 0, lineTotal: 0 }];

  const updateSubcategory = (index: number, updates: Partial<SubcategoryLine>) => {
    if (!editing) return;
    const next = [...subcategoryBreakdown];
    const candidate = { ...next[index], ...updates };
    const quantity = Number(candidate.quantity || 0);
    const unitPrice = Number(candidate.unitPrice || 0);
    if ((updates.quantity !== undefined || updates.unitPrice !== undefined) && quantity && unitPrice) {
      candidate.lineTotal = roundMoney(quantity * unitPrice, normalizeCurrency(editing.currency) === "TZS" ? 0 : 2);
      candidate.amount = candidate.lineTotal;
    }
    if (updates.lineTotal !== undefined && updates.amount === undefined) {
      candidate.amount = Number(updates.lineTotal || 0);
    }
    const fx = buildDualCurrencyAmounts({
      amount: Number(candidate.amount || 0),
      currency: editing.currency,
      fxUsdThs: editing.fxUsdThs,
      fxThsUsd: editing.fxThsUsd,
    });
    next[index] = {
      name: candidate.name || "",
      quantity: candidate.quantity,
      unit: candidate.unit || "",
      unitPrice: candidate.unitPrice,
      lineTotal: candidate.lineTotal ?? candidate.amount,
      amount: Number(candidate.amount || 0),
      amountUsd: fx.amountUsd,
      amountThs: fx.amountThs,
    };
    updateEditing({
      subcategoryBreakdown: next,
      subcategories: next.map(item => item.name).filter(Boolean),
    });
  };

  const addSubcategory = () => {
    if (!editing) return;
    updateEditing({
      subcategoryBreakdown: [...subcategoryBreakdown, { name: "", amount: 0, amountUsd: 0, amountThs: 0, lineTotal: 0 }],
    });
  };

  const removeSubcategory = (index: number) => {
    if (!editing) return;
    const next = subcategoryBreakdown.filter((_, itemIndex) => itemIndex !== index);
    updateEditing({
      subcategoryBreakdown: next.length ? next : [{ name: "", amount: 0, amountUsd: 0, amountThs: 0, lineTotal: 0 }],
      subcategories: next.map(item => item.name).filter(Boolean),
    });
  };

  const removeExistingAttachment = (attachmentId: string) => {
    if (!editing) return;
    updateEditing({
      attachments: (editing.attachments || []).filter(attachment => attachment.id !== attachmentId),
    });
  };

  const editingUsd = editing ? getEntryUsdAmount(normalizeAccountancyEntry(editing)) : 0;
  const editingThs = editing ? getEntryThsAmount(normalizeAccountancyEntry(editing)) : 0;
  const subcategoryTotal = subcategoryBreakdown.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{scopeDescription}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportLedgerPdf}>
            <Download className="mr-2 h-4 w-4" />
            PDF
          </Button>
          <Button onClick={startNew}>
            <Plus className="mr-2 h-4 w-4" />
            Add Entry
          </Button>
        </div>
      </div>

      <div className="border-b border-border bg-muted/10 p-5">
        <AccountancyDateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {editing && (
        <div className="border-b border-border bg-muted/20 p-5">
          <datalist id="accountancy-category-options">
            {currentCategoryOptions.map(option => (
              <option key={option} value={option} />
            ))}
          </datalist>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block text-sm font-medium">
              Type
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={editing.type}
                onChange={event => updateEditing({ type: event.target.value as AccountancyEntry["type"], category: "" })}
                disabled={availableTypes.length === 1}
              >
                {availableTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>
            <InputField label="Date" type="date" value={editing.date} onChange={value => updateEditing({ date: value })} />
            <InputField label="Category" list="accountancy-category-options" value={editing.category} onChange={value => updateEditing({ category: value })} />
            <InputField label="Counterparty" value={editing.counterparty} onChange={value => updateEditing({ counterparty: value })} />
            <InputField label="Reference" value={editing.reference || ""} onChange={value => updateEditing({ reference: value })} />
            <InputField label="Invoice Total" type="number" value={String(editing.amount || 0)} onChange={value => updateEditing({ amount: Number(value) })} />
            <label className="block text-sm font-medium">
              Invoice Currency
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={normalizeCurrency(editing.currency)}
                onChange={event => updateEditing({ currency: event.target.value })}
              >
                <option value="USD">USD</option>
                <option value="TZS">TZS</option>
              </select>
            </label>
            <InputField label="FX_USD_TZS" type="number" value={String(editing.fxUsdThs || "")} onChange={value => updateEditing({ fxUsdThs: Number(value), fxThsUsd: Number(value) ? 1 / Number(value) : 0 })} />
            <InputField label="FX_TZS_USD" type="number" value={String(editing.fxThsUsd || "")} onChange={value => updateEditing({ fxThsUsd: Number(value), fxUsdThs: Number(value) ? 1 / Number(value) : 0 })} />
            <ReadOnlyValue label="Amount USD" value={formatMoney(editingUsd, "USD")} />
            <ReadOnlyValue label="Amount TZS" value={formatMoney(editingThs, "TZS")} />
            {fxStatus && <p className="text-xs text-muted-foreground md:col-span-3">{fxStatus}</p>}

            <label className="block text-sm font-medium">
              IFRS Treatment
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={editing.ifrsTreatment || ""}
                onChange={event => updateEditing({ ifrsTreatment: event.target.value as AccountancyEntry["ifrsTreatment"] })}
              >
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
            <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(editing.capitalizationCandidate)}
                onChange={event => updateEditing({ capitalizationCandidate: event.target.checked })}
              />
              Capitalization candidate
            </label>
            <InputField label="Useful Life (months)" type="number" value={String(editing.assetUsefulLifeMonths || 0)} onChange={value => updateEditing({ assetUsefulLifeMonths: Number(value) })} />

            {editing.type === "Revenue" && (
              <>
                <InputField label="Reservation ID" value={editing.reservationId || ""} onChange={value => updateEditing({ reservationId: value })} />
                <InputField label="Customer Invoice ID" value={editing.customerInvoiceId || ""} onChange={value => updateEditing({ customerInvoiceId: value })} />
              </>
            )}
            {editing.type === "Expense" && (
              <InputField label="Supplier Invoice ID" value={editing.supplierInvoiceId || ""} onChange={value => updateEditing({ supplierInvoiceId: value })} />
            )}
            <InputField label="Tax Amount" type="number" value={String(editing.taxAmount || 0)} onChange={value => updateEditing({ taxAmount: Number(value) })} />
            <label className="block text-sm font-medium">
              Document Type
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={editing.documentType}
                onChange={event => updateEditing({ documentType: event.target.value as AccountancyEntry["documentType"] })}
              >
                <option value="Supplier Invoice">Supplier Invoice</option>
                <option value="Proof of Payment">Proof of Payment</option>
                <option value="Reservation Payment">Reservation Payment</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <div className="rounded-lg border border-border bg-background p-4 md:col-span-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Supporting documents</p>
                  <p className="text-xs text-muted-foreground">Attach supplier invoices, proof of payment, or other supporting files for this ledger entry.</p>
                </div>
                <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
                  <Paperclip className="mr-2 h-4 w-4" />
                  Attach files
                  <input
                    className="hidden"
                    type="file"
                    multiple
                    accept="image/*,application/pdf,text/plain,text/csv"
                    onChange={event => setAttachmentFiles(current => [...current, ...Array.from(event.target.files || [])])}
                  />
                </label>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {(editing.attachments || []).map(attachment => (
                  <AttachmentPill
                    key={attachment.id}
                    attachment={attachment}
                    onRemove={() => removeExistingAttachment(attachment.id)}
                  />
                ))}
                {attachmentFiles.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">{file.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                    </span>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setAttachmentFiles(current => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove pending file">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {!editing.attachments?.length && !attachmentFiles.length && (
                  <p className="text-sm text-muted-foreground">No supporting documents attached yet.</p>
                )}
              </div>
            </div>

            <div className="md:col-span-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Subcategories with amount allocation</p>
                  <p className="text-xs text-muted-foreground">
                    Subcategory total: {formatMoney(subcategoryTotal, editing.currency)} / Invoice total: {formatMoney(editing.amount, editing.currency)}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addSubcategory}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>
              <div className="space-y-3">
                {subcategoryBreakdown.map((subcategory, index) => (
                  <div key={index} className="grid gap-2 rounded-lg border border-border bg-background p-3 md:grid-cols-6">
                    <Input
                      className="md:col-span-2"
                      value={subcategory.name}
                      onChange={event => updateSubcategory(index, { name: event.target.value })}
                      placeholder={index === 0 ? "e.g., Carrot, Chicken, Room upgrade..." : "Additional subcategory"}
                    />
                    <Input
                      type="number"
                      value={String(subcategory.quantity || "")}
                      onChange={event => updateSubcategory(index, { quantity: Number(event.target.value) })}
                      placeholder="Qty"
                    />
                    <Input
                      value={subcategory.unit || ""}
                      onChange={event => updateSubcategory(index, { unit: event.target.value })}
                      placeholder="Unit"
                    />
                    <Input
                      type="number"
                      value={String(subcategory.unitPrice || "")}
                      onChange={event => updateSubcategory(index, { unitPrice: Number(event.target.value) })}
                      placeholder="Unit price"
                    />
                    <Input
                      type="number"
                      value={String(subcategory.lineTotal ?? subcategory.amount ?? 0)}
                      onChange={event => updateSubcategory(index, { lineTotal: Number(event.target.value), amount: Number(event.target.value) })}
                      placeholder="Line total"
                    />
                    <Input
                      type="number"
                      value={String(subcategory.amount || 0)}
                      onChange={event => updateSubcategory(index, { amount: Number(event.target.value) })}
                      placeholder="Allocation"
                    />
                    <div className="rounded-md bg-muted px-3 py-2 text-xs md:col-span-2">
                      <span className="block text-muted-foreground">USD</span>
                      <span className="font-semibold">{formatMoney(subcategory.amountUsd || 0, "USD")}</span>
                    </div>
                    <div className="rounded-md bg-muted px-3 py-2 text-xs md:col-span-2">
                      <span className="block text-muted-foreground">TZS</span>
                      <span className="font-semibold">{formatMoney(subcategory.amountThs || 0, "TZS")}</span>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => removeSubcategory(index)} aria-label="Remove subcategory">
                      <X className="h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <label className="block text-sm font-medium md:col-span-3">
              Description
              <textarea
                className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={editing.description}
                onChange={event => updateEditing({ description: event.target.value })}
              />
            </label>
            <label className="block text-sm font-medium md:col-span-3">
              IFRS Notes
              <textarea
                className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={editing.ifrsNotes || ""}
                onChange={event => updateEditing({ ifrsNotes: event.target.value })}
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setAttachmentFiles([]); setEditing(null); }}>Cancel</Button>
            <Button onClick={saveEntry}>Save Entry</Button>
          </div>
        </div>
      )}

      <div className="overflow-auto">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="p-4 font-medium">Date</th>
              <th className="p-4 font-medium">Type</th>
              <th className="p-4 font-medium">Category</th>
              <th className="p-4 font-medium">Subcategories</th>
              <th className="p-4 font-medium">Traceability</th>
              <th className="p-4 font-medium">Documents</th>
              <th className="p-4 font-medium">Currency</th>
              <th className="p-4 font-medium">FX_USD_TZS</th>
              <th className="p-4 font-medium">FX_TZS_USD</th>
              <th className="p-4 text-right font-medium">{accountancyDisplayCurrency}</th>
              <th className="p-4 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => {
              const positive = entry.type === "Revenue" || entry.type === "Asset";
              return (
                <tr key={entry.id} className="border-b border-border">
                  <td className="p-4 text-muted-foreground">{entry.date}</td>
                  <td className="p-4 font-medium">{entry.type}</td>
                  <td className="p-4">{getDatedCategoryName(entry.category, entry.date)}</td>
                  <td className="p-4 text-xs text-muted-foreground">
                    {entry.subcategoryBreakdown?.length
                      ? entry.subcategoryBreakdown.map(item => formatAccountancyLineItem(item, entry.currency)).join(", ")
                      : "Unassigned"}
                  </td>
                  <td className="p-4 text-xs text-muted-foreground">{formatTraceability(entry)}</td>
                  <td className="p-4 text-xs text-muted-foreground">
                    <AttachmentList entry={entry} />
                  </td>
                  <td className="p-4 text-muted-foreground">{entry.currency}</td>
                  <td className="p-4 text-muted-foreground">{Number(entry.fxUsdThs || 0).toFixed(6)}</td>
                  <td className="p-4 text-muted-foreground">{Number(entry.fxThsUsd || 0).toFixed(8)}</td>
                  <td className={`p-4 text-right font-semibold ${positive ? "text-green-600" : "text-destructive"}`}>
                    {positive ? "" : "-"}{formatDisplayMoney(getEntryDisplayAmount(entry, accountancyDisplayCurrency), accountancyDisplayCurrency)}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setAttachmentFiles([]); setEditing(normalizeAccountancyEntry(entry)); }}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeEntry(entry)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!entries.length && (
              <tr>
                <td colSpan={11} className="p-8 text-center text-muted-foreground">No manual or AI ledger entries for this scope yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function recalculateEditing(entry: AccountancyEntry) {
  const fx = buildDualCurrencyAmounts({
    amount: Number(entry.amount || 0),
    currency: entry.currency,
    fxUsdThs: entry.fxUsdThs,
    fxThsUsd: entry.fxThsUsd,
  });
  const currency = normalizeCurrency(entry.currency);
  const subcategoryBreakdown = (entry.subcategoryBreakdown?.length ? entry.subcategoryBreakdown : [{ name: "", amount: 0, amountUsd: 0, amountThs: 0, lineTotal: 0 }])
    .map(item => {
      const quantity = Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : undefined;
      const unitPrice = Number.isFinite(Number(item.unitPrice)) ? Number(item.unitPrice) : undefined;
      const computedLineTotal = quantity && unitPrice ? roundMoney(quantity * unitPrice, currency === "TZS" ? 0 : 2) : undefined;
      const lineTotal = Number.isFinite(Number(item.lineTotal)) ? Number(item.lineTotal) : computedLineTotal;
      const amount = Number.isFinite(Number(item.amount)) ? Number(item.amount) : Number(lineTotal || 0);
      const itemFx = buildDualCurrencyAmounts({
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
      const lineFx = Number.isFinite(Number(lineTotal)) ? buildDualCurrencyAmounts({
        amount: Number(lineTotal),
        currency,
        fxUsdThs: fx.fxUsdThs,
        fxThsUsd: fx.fxThsUsd,
      }) : itemFx;
      return {
        name: item.name || "",
        quantity,
        unit: item.unit || "",
        unitPrice,
        lineTotal: Number.isFinite(Number(lineTotal)) ? Number(lineTotal) : amount,
        amount,
        amountUsd: itemFx.amountUsd,
        amountThs: itemFx.amountThs,
        unitPriceUsd: unitFx?.amountUsd,
        unitPriceThs: unitFx?.amountThs,
        lineTotalUsd: lineFx.amountUsd,
        lineTotalThs: lineFx.amountThs,
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

function normalizeBeforeSave(entry: AccountancyEntry, propertyId: string) {
  const recalculated = recalculateEditing({
    ...entry,
    propertyId,
    amount: Number(entry.amount),
    taxAmount: Number(entry.taxAmount || 0),
    source: entry.source || "Manual",
    status: "Confirmed",
    createdAt: entry.createdAt || new Date().toISOString(),
  });

  return {
    ...recalculated,
    category: getDatedCategoryName(recalculated.category, recalculated.date),
    subcategoryBreakdown: recalculated.subcategoryBreakdown?.filter(item => item.name.trim()),
    subcategories: recalculated.subcategoryBreakdown?.map(item => item.name.trim()).filter(Boolean),
  };
}

function validateSubcategoryTotals(entry: AccountancyEntry) {
  const breakdown = entry.subcategoryBreakdown || [];
  if (!breakdown.length) return "";

  const total = breakdown.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const tolerance = normalizeCurrency(entry.currency) === "TZS" ? 1 : 0.01;
  const difference = roundMoney(total - Number(entry.amount || 0), normalizeCurrency(entry.currency) === "TZS" ? 0 : 2);
  if (Math.abs(difference) <= tolerance) return "";

  return `Subcategory amounts must equal the invoice total. Current subcategory total is ${formatMoney(total, entry.currency)} and invoice total is ${formatMoney(entry.amount, entry.currency)}. Difference: ${formatMoney(difference, entry.currency)}.`;
}

function formatTraceability(entry: AccountancyEntry) {
  const items = [
    entry.reservationId ? `Reservation: ${entry.reservationId}` : "",
    entry.customerInvoiceId ? `Customer invoice: ${entry.customerInvoiceId}` : "",
    entry.supplierInvoiceId ? `Supplier invoice: ${entry.supplierInvoiceId}` : "",
    entry.reference ? `Reference: ${entry.reference}` : "",
  ].filter(Boolean);

  return items.length ? items.join(" | ") : "-";
}

function AttachmentList({ entry }: { entry: AccountancyEntry }) {
  const attachments = entry.attachments || [];
  if (!attachments.length && !entry.attachmentName) return <span>-</span>;

  return (
    <div className="space-y-1">
      {attachments.map(attachment => (
        <a
          key={attachment.id}
          className="block max-w-[220px] truncate text-primary underline-offset-2 hover:underline"
          href={attachment.downloadUrl}
          target="_blank"
          rel="noreferrer"
          title={attachment.name}
        >
          {attachment.name}
        </a>
      ))}
      {!attachments.length && entry.attachmentName && <span>{entry.attachmentName}</span>}
    </div>
  );
}

function AttachmentPill({
  attachment,
  onRemove,
}: {
  attachment: AccountancyAttachment;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
      <a
        className="flex min-w-0 items-center gap-2 text-primary underline-offset-2 hover:underline"
        href={attachment.downloadUrl}
        target="_blank"
        rel="noreferrer"
      >
        <FileText className="h-4 w-4 shrink-0" />
        <span className="truncate">{attachment.name}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(attachment.size)}</span>
      </a>
      <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="Remove attachment">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function formatFileSize(size: number) {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  list,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  list?: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <Input className="mt-1" type={type} list={list} value={value} onChange={event => onChange(event.target.value)} />
    </label>
  );
}

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="block text-sm font-medium">
      {label}
      <div className="mt-1 flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm font-semibold">
        {value}
      </div>
    </div>
  );
}
