import { useState } from "react";
import { Calculator, Plus, ShieldCheck } from "lucide-react";
import { AccountancyLedgerManager } from "../../components/accountancy/AccountancyLedgerManager";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useAppContext } from "../../context/AppContext";
import { buildDualCurrencyAmounts, formatMoney, getTodayIsoDate, normalizeAccountancyEntry } from "../../utils/accountancy";

type AdjustmentMode = "Depreciation" | "Amortization" | "Asset Increase";

const defaultFxUsdTzs = 2600;

export function AccountancyAmortization() {
  const { selectedPropertyId, addAccountancyEntry } = useAppContext();
  const [mode, setMode] = useState<AdjustmentMode>("Depreciation");
  const [date, setDate] = useState(getTodayIsoDate());
  const [assetName, setAssetName] = useState("");
  const [amount, setAmount] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [fxUsdThs, setFxUsdThs] = useState(defaultFxUsdTzs);
  const [counterparty, setCounterparty] = useState("Internal accounting adjustment");
  const [reference, setReference] = useState("");
  const [linkedAssetEntryId, setLinkedAssetEntryId] = useState("");
  const [usefulLifeMonths, setUsefulLifeMonths] = useState(60);
  const [notes, setNotes] = useState("");

  const fxThsUsd = fxUsdThs ? 1 / fxUsdThs : 1 / defaultFxUsdTzs;
  const displayFx = buildDualCurrencyAmounts({ amount, currency, fxUsdThs, fxThsUsd });

  const createAdjustment = () => {
    if (!selectedPropertyId) {
      alert("Select an active property before creating an amortization or asset adjustment.");
      return;
    }
    if (!assetName.trim() || !date || !Number(amount)) {
      alert("Complete date, asset name, and amount.");
      return;
    }

    const base = {
      propertyId: selectedPropertyId,
      date,
      counterparty,
      amount: Number(amount),
      currency,
      fxUsdThs,
      fxThsUsd,
      reference,
      taxAmount: 0,
      source: "Manual" as const,
      status: "Confirmed" as const,
      documentType: "Other" as const,
      paymentMethod: "",
      linkedAssetEntryId,
      assetUsefulLifeMonths: usefulLifeMonths,
      depreciationMethod: "Straight-line" as const,
      ifrsNotes: notes,
      attachments: [],
      createdAt: new Date().toISOString(),
    };

    if (mode === "Asset Increase") {
      addAccountancyEntry(normalizeAccountancyEntry({
        ...base,
        id: `acc-asset-${Date.now()}`,
        type: "Asset",
        category: "Capital Improvements",
        subcategories: [assetName],
        subcategoryBreakdown: [buildLine(assetName, amount, currency, fxUsdThs, fxThsUsd)],
        description: `Asset value increase for ${assetName}. ${notes}`.trim(),
        ifrsTreatment: "PPE Capitalization",
        capitalizationCandidate: true,
      }));
      resetForm();
      return;
    }

    const isAmortization = mode === "Amortization";
    addAccountancyEntry(normalizeAccountancyEntry({
      ...base,
      id: `acc-amort-exp-${Date.now()}`,
      type: "Expense",
      category: "Depreciation & Amortization",
      subcategories: [assetName],
      subcategoryBreakdown: [buildLine(assetName, amount, currency, fxUsdThs, fxThsUsd)],
      description: `${mode} expense for ${assetName}. ${notes}`.trim(),
      ifrsTreatment: isAmortization ? "Intangible Amortization" : "PPE Depreciation",
      capitalizationCandidate: false,
    }));

    addAccountancyEntry(normalizeAccountancyEntry({
      ...base,
      id: `acc-amort-asset-${Date.now()}`,
      type: "Asset",
      category: isAmortization ? "Accumulated Amortization" : "Accumulated Depreciation",
      amount: -Math.abs(Number(amount)),
      subcategories: [assetName],
      subcategoryBreakdown: [buildLine(assetName, -Math.abs(Number(amount)), currency, fxUsdThs, fxThsUsd)],
      description: `Contra-asset adjustment for ${mode.toLowerCase()} of ${assetName}. ${notes}`.trim(),
      ifrsTreatment: isAmortization ? "Intangible Amortization" : "PPE Depreciation",
      capitalizationCandidate: false,
    }));

    resetForm();
  };

  const resetForm = () => {
    setAssetName("");
    setAmount(0);
    setReference("");
    setLinkedAssetEntryId("");
    setNotes("");
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">IFRS Asset Lifecycle</p>
        <h1 className="text-3xl font-bold">Depreciation & Amortization</h1>
        <p className="text-muted-foreground">
          Create controlled asset increases, depreciation expenses, amortization expenses, and matching Balance adjustments for the active property.
        </p>
      </div>

      <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold">Operational IFRS guardrail</p>
            <p className="text-muted-foreground">
              PPE improvements are capitalized when they create future economic benefits. Repairs and consumables remain expenses. Depreciation and amortization create an Expense entry for P&L and a negative Asset adjustment for Balance.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Create IFRS Adjustment</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-sm font-medium">
            Adjustment Type
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={mode} onChange={event => setMode(event.target.value as AdjustmentMode)}>
              <option value="Depreciation">Depreciation</option>
              <option value="Amortization">Amortization</option>
              <option value="Asset Increase">Asset Increase</option>
            </select>
          </label>
          <InputField label="Date" type="date" value={date} onChange={setDate} />
          <InputField label="Asset / Improvement Name" value={assetName} onChange={setAssetName} />
          <InputField label="Amount" type="number" value={String(amount || 0)} onChange={value => setAmount(Number(value))} />
          <label className="block text-sm font-medium">
            Currency
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={currency} onChange={event => setCurrency(event.target.value)}>
              <option value="USD">USD</option>
              <option value="TZS">TZS</option>
            </select>
          </label>
          <InputField label="FX_USD_TZS" type="number" value={String(fxUsdThs || "")} onChange={value => setFxUsdThs(Number(value))} />
          <InputField label="Counterparty" value={counterparty} onChange={setCounterparty} />
          <InputField label="Reference" value={reference} onChange={setReference} />
          <InputField label="Linked Asset Entry ID" value={linkedAssetEntryId} onChange={setLinkedAssetEntryId} />
          <InputField label="Useful Life (months)" type="number" value={String(usefulLifeMonths || 0)} onChange={value => setUsefulLifeMonths(Number(value))} />
          <ReadOnlyValue label="Amount USD" value={formatMoney(displayFx.amountUsd, "USD")} />
          <ReadOnlyValue label="Amount TZS" value={formatMoney(displayFx.amountThs, "TZS")} />
          <label className="block text-sm font-medium md:col-span-3">
            IFRS Notes
            <textarea className="mt-1 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={notes} onChange={event => setNotes(event.target.value)} />
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={createAdjustment}>
            <Plus className="mr-2 h-4 w-4" />
            Create Adjustment
          </Button>
        </div>
      </div>

      <AccountancyLedgerManager
        title="Manage Depreciation, Amortization, and Asset Value Adjustments"
        filter="All"
        allowedTypes={["Expense", "Asset"]}
      />
    </div>
  );
}

function buildLine(name: string, amount: number, currency: string, fxUsdThs: number, fxThsUsd: number) {
  const fx = buildDualCurrencyAmounts({ amount, currency, fxUsdThs, fxThsUsd });
  return {
    name,
    amount,
    amountUsd: fx.amountUsd,
    amountThs: fx.amountThs,
    lineTotal: amount,
    lineTotalUsd: fx.amountUsd,
    lineTotalThs: fx.amountThs,
  };
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <Input className="mt-1" type={type} value={value} onChange={event => onChange(event.target.value)} />
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
