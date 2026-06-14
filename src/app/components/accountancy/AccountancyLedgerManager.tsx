import { useEffect, useMemo, useState } from "react";
import { Edit, Plus, Trash2, X } from "lucide-react";
import type { AccountancyEntry } from "../../context/AppContext";
import { useAppContext } from "../../context/AppContext";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  buildDualCurrencyAmounts,
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
import { fetchFxRateForDate } from "../../utils/fxRates";

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
  ],
  Asset: [
    "Cash and Bank",
    "Accounts Receivable",
    "Inventory",
    "Fixed Assets",
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
    id: "",
    propertyId,
    type,
    date: new Date().toISOString().split("T")[0],
    category: "",
    subcategories: [""],
    subcategoryBreakdown: [{ name: "", amount: 0, amountUsd: 0, amountThs: 0 }],
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
  const [fxStatus, setFxStatus] = useState("");

  const entries = accountancyEntries
    .filter(entry => entry.propertyId === selectedPropertyId)
    .filter(entry => availableTypes.includes(entry.type))
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

  const startNew = () => setEditing(blankEntry(selectedPropertyId, defaultType));

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

  const saveEntry = () => {
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

    if (normalized.id) {
      updateAccountancyEntry(normalized.id, normalized);
    } else {
      addAccountancyEntry({ ...normalized, id: `acc-${Date.now()}` });
    }
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
    : [{ name: "", amount: 0, amountUsd: 0, amountThs: 0 }];

  const updateSubcategory = (index: number, updates: Partial<SubcategoryLine>) => {
    if (!editing) return;
    const next = [...subcategoryBreakdown];
    const candidate = { ...next[index], ...updates };
    const fx = buildDualCurrencyAmounts({
      amount: Number(candidate.amount || 0),
      currency: editing.currency,
      fxUsdThs: editing.fxUsdThs,
      fxThsUsd: editing.fxThsUsd,
    });
    next[index] = {
      name: candidate.name || "",
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
      subcategoryBreakdown: [...subcategoryBreakdown, { name: "", amount: 0, amountUsd: 0, amountThs: 0 }],
    });
  };

  const removeSubcategory = (index: number) => {
    if (!editing) return;
    const next = subcategoryBreakdown.filter((_, itemIndex) => itemIndex !== index);
    updateEditing({
      subcategoryBreakdown: next.length ? next : [{ name: "", amount: 0, amountUsd: 0, amountThs: 0 }],
      subcategories: next.map(item => item.name).filter(Boolean),
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
        <Button onClick={startNew}>
          <Plus className="mr-2 h-4 w-4" />
          Add Entry
        </Button>
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
                <option value="THS">THS</option>
              </select>
            </label>
            <InputField label="FX_USD_THS" type="number" value={String(editing.fxUsdThs || "")} onChange={value => updateEditing({ fxUsdThs: Number(value), fxThsUsd: Number(value) ? 1 / Number(value) : 0 })} />
            <InputField label="FX_THS_USD" type="number" value={String(editing.fxThsUsd || "")} onChange={value => updateEditing({ fxThsUsd: Number(value), fxUsdThs: Number(value) ? 1 / Number(value) : 0 })} />
            <ReadOnlyValue label="Amount USD" value={formatMoney(editingUsd, "USD")} />
            <ReadOnlyValue label="Amount THS" value={formatMoney(editingThs, "THS")} />
            {fxStatus && <p className="text-xs text-muted-foreground md:col-span-3">{fxStatus}</p>}

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
                  <div key={index} className="grid gap-2 rounded-lg border border-border bg-background p-3 md:grid-cols-[minmax(0,1fr)_160px_140px_140px_40px]">
                    <Input
                      value={subcategory.name}
                      onChange={event => updateSubcategory(index, { name: event.target.value })}
                      placeholder={index === 0 ? "e.g., Carrot, Chicken, Room upgrade..." : "Additional subcategory"}
                    />
                    <Input
                      type="number"
                      value={String(subcategory.amount || 0)}
                      onChange={event => updateSubcategory(index, { amount: Number(event.target.value) })}
                      placeholder="Amount"
                    />
                    <div className="rounded-md bg-muted px-3 py-2 text-xs">
                      <span className="block text-muted-foreground">USD</span>
                      <span className="font-semibold">{formatMoney(subcategory.amountUsd || 0, "USD")}</span>
                    </div>
                    <div className="rounded-md bg-muted px-3 py-2 text-xs">
                      <span className="block text-muted-foreground">THS</span>
                      <span className="font-semibold">{formatMoney(subcategory.amountThs || 0, "THS")}</span>
                    </div>
                    <Button type="button" variant="outline" size="icon" onClick={() => removeSubcategory(index)} aria-label="Remove subcategory">
                      <X className="h-4 w-4" />
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
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
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
              <th className="p-4 font-medium">Currency</th>
              <th className="p-4 font-medium">FX_USD_THS</th>
              <th className="p-4 font-medium">FX_THS_USD</th>
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
                      ? entry.subcategoryBreakdown.map(item => `${item.name}: ${formatMoney(item.amount, entry.currency)}`).join(", ")
                      : "Unassigned"}
                  </td>
                  <td className="p-4 text-xs text-muted-foreground">{formatTraceability(entry)}</td>
                  <td className="p-4 text-muted-foreground">{entry.currency}</td>
                  <td className="p-4 text-muted-foreground">{Number(entry.fxUsdThs || 0).toFixed(6)}</td>
                  <td className="p-4 text-muted-foreground">{Number(entry.fxThsUsd || 0).toFixed(8)}</td>
                  <td className={`p-4 text-right font-semibold ${positive ? "text-green-600" : "text-destructive"}`}>
                    {positive ? "" : "-"}{formatDisplayMoney(getEntryDisplayAmount(entry, accountancyDisplayCurrency), accountancyDisplayCurrency)}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(normalizeAccountancyEntry(entry))}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeEntry(entry)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!entries.length && (
              <tr>
                <td colSpan={10} className="p-8 text-center text-muted-foreground">No manual or AI ledger entries for this scope yet.</td>
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
  const subcategoryBreakdown = (entry.subcategoryBreakdown?.length ? entry.subcategoryBreakdown : [{ name: "", amount: 0, amountUsd: 0, amountThs: 0 }])
    .map(item => {
      const itemFx = buildDualCurrencyAmounts({
        amount: Number(item.amount || 0),
        currency,
        fxUsdThs: fx.fxUsdThs,
        fxThsUsd: fx.fxThsUsd,
      });
      return {
        name: item.name || "",
        amount: Number(item.amount || 0),
        amountUsd: itemFx.amountUsd,
        amountThs: itemFx.amountThs,
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
  const tolerance = normalizeCurrency(entry.currency) === "THS" ? 1 : 0.01;
  const difference = roundMoney(total - Number(entry.amount || 0), normalizeCurrency(entry.currency) === "THS" ? 0 : 2);
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
