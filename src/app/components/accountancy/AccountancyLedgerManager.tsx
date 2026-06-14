import { useMemo, useState } from "react";
import { Edit, Plus, Trash2, X } from "lucide-react";
import type { AccountancyEntry } from "../../context/AppContext";
import { useAppContext } from "../../context/AppContext";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { formatMoney } from "../../utils/accountancy";

type LedgerFilter = AccountancyEntry["type"] | "All";

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

const blankEntry = (propertyId: string, type: AccountancyEntry["type"]): AccountancyEntry => ({
  id: "",
  propertyId,
  type,
  date: new Date().toISOString().split("T")[0],
  category: "",
  subcategories: [""],
  counterparty: "",
  description: "",
  amount: 0,
  currency: "USD",
  documentType: "Other",
  paymentMethod: "",
  reference: "",
  taxAmount: 0,
  source: "Manual",
  status: "Confirmed",
  createdAt: new Date().toISOString(),
});

export function AccountancyLedgerManager({
  title = "Manual Accountancy Ledger",
  filter = "All",
}: {
  title?: string;
  filter?: LedgerFilter;
}) {
  const {
    selectedPropertyId,
    accountancyEntries,
    addAccountancyEntry,
    updateAccountancyEntry,
    deleteAccountancyEntry,
  } = useAppContext();
  const defaultType: AccountancyEntry["type"] = filter === "All" ? "Revenue" : filter;
  const [editing, setEditing] = useState<AccountancyEntry | null>(null);

  const entries = accountancyEntries
    .filter(entry => entry.propertyId === selectedPropertyId)
    .filter(entry => filter === "All" || entry.type === filter)
    .sort((a, b) => b.date.localeCompare(a.date));

  const currentCategoryOptions = useMemo(
    () => categoryOptions[(editing?.type || defaultType) as AccountancyEntry["type"]],
    [editing?.type, defaultType],
  );

  const startNew = () => setEditing(blankEntry(selectedPropertyId, defaultType));

  const saveEntry = () => {
    if (!editing) return;
    if (!editing.date || !editing.category || !editing.counterparty || !editing.description || !Number(editing.amount)) {
      alert("Complete date, category, counterparty, description, and amount.");
      return;
    }

    const payload: AccountancyEntry = {
      ...editing,
      propertyId: selectedPropertyId,
      amount: Number(editing.amount),
      taxAmount: Number(editing.taxAmount || 0),
      subcategories: (editing.subcategories || []).map(item => item.trim()).filter(Boolean),
      currency: (editing.currency || "USD").toUpperCase(),
      source: editing.source || "Manual",
      status: "Confirmed",
      createdAt: editing.createdAt || new Date().toISOString(),
    };

    if (payload.id) {
      updateAccountancyEntry(payload.id, payload);
    } else {
      addAccountancyEntry({ ...payload, id: `acc-${Date.now()}` });
    }
    setEditing(null);
  };

  const removeEntry = (entry: AccountancyEntry) => {
    if (confirm(`Delete ${entry.type.toLowerCase()} entry "${entry.category}" for ${formatMoney(entry.amount, entry.currency)}?`)) {
      deleteAccountancyEntry(entry.id);
    }
  };

  const updateSubcategory = (index: number, value: string) => {
    if (!editing) return;
    const next = [...(editing.subcategories?.length ? editing.subcategories : [""])];
    next[index] = value;
    setEditing({ ...editing, subcategories: next });
  };

  const addSubcategory = () => {
    if (!editing) return;
    setEditing({ ...editing, subcategories: [...(editing.subcategories?.length ? editing.subcategories : [""]), ""] });
  };

  const removeSubcategory = (index: number) => {
    if (!editing) return;
    const current = editing.subcategories?.length ? editing.subcategories : [""];
    const next = current.filter((_, itemIndex) => itemIndex !== index);
    setEditing({ ...editing, subcategories: next.length ? next : [""] });
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">Manual entries are scoped only to the active property and feed Revenues, Expenses, P&L, and Balance.</p>
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
                onChange={event => setEditing({ ...editing, type: event.target.value as AccountancyEntry["type"], category: "" })}
                disabled={filter !== "All"}
              >
                <option value="Revenue">Revenue</option>
                <option value="Expense">Expense</option>
                <option value="Asset">Asset</option>
                <option value="Liability">Liability</option>
              </select>
            </label>
            <InputField label="Date" type="date" value={editing.date} onChange={value => setEditing({ ...editing, date: value })} />
            <InputField label="Category" list="accountancy-category-options" value={editing.category} onChange={value => setEditing({ ...editing, category: value })} />
            <InputField label="Counterparty" value={editing.counterparty} onChange={value => setEditing({ ...editing, counterparty: value })} />
            <InputField label="Reference" value={editing.reference || ""} onChange={value => setEditing({ ...editing, reference: value })} />
            <InputField label="Amount" type="number" value={String(editing.amount || 0)} onChange={value => setEditing({ ...editing, amount: Number(value) })} />
            <InputField label="Currency" value={editing.currency || "USD"} onChange={value => setEditing({ ...editing, currency: value.toUpperCase() })} />
            <InputField label="Tax Amount" type="number" value={String(editing.taxAmount || 0)} onChange={value => setEditing({ ...editing, taxAmount: Number(value) })} />
            <label className="block text-sm font-medium">
              Document Type
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={editing.documentType}
                onChange={event => setEditing({ ...editing, documentType: event.target.value as AccountancyEntry["documentType"] })}
              >
                <option value="Supplier Invoice">Supplier Invoice</option>
                <option value="Proof of Payment">Proof of Payment</option>
                <option value="Reservation Payment">Reservation Payment</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <div className="md:col-span-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Subcategories</p>
                <Button type="button" variant="outline" size="sm" onClick={addSubcategory}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {(editing.subcategories?.length ? editing.subcategories : [""]).map((subcategory, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={subcategory}
                      onChange={event => updateSubcategory(index, event.target.value)}
                      placeholder={index === 0 ? "e.g., Carrot, Chicken, Room upgrade..." : "Additional subcategory"}
                    />
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
                onChange={event => setEditing({ ...editing, description: event.target.value })}
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
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="p-4 font-medium">Date</th>
              <th className="p-4 font-medium">Type</th>
              <th className="p-4 font-medium">Category</th>
              <th className="p-4 font-medium">Subcategories</th>
              <th className="p-4 font-medium">Counterparty</th>
              <th className="p-4 font-medium">Source</th>
              <th className="p-4 text-right font-medium">Amount</th>
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
                  <td className="p-4">{entry.category}</td>
                  <td className="p-4 text-xs text-muted-foreground">
                    {(entry.subcategories || []).length ? entry.subcategories?.join(", ") : "Unassigned"}
                  </td>
                  <td className="p-4 text-muted-foreground">{entry.counterparty}</td>
                  <td className="p-4 text-muted-foreground">{entry.source}</td>
                  <td className={`p-4 text-right font-semibold ${positive ? "text-green-600" : "text-destructive"}`}>
                    {positive ? "" : "-"}{formatMoney(entry.amount, entry.currency)}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing({ ...entry, subcategories: entry.subcategories?.length ? entry.subcategories : [""] })}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeEntry(entry)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!entries.length && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">No manual or AI ledger entries for this scope yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
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
