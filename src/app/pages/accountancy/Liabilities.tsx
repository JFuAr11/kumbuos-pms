import { Download, Scale } from "lucide-react";
import { AccountancyLedgerManager } from "../../components/accountancy/AccountancyLedgerManager";
import { AccountancyCurrencyFilter } from "../../components/accountancy/AccountancyCurrencyFilter";
import { Button } from "../../components/ui/button";
import { useAppContext } from "../../context/AppContext";
import { exportToCSV, exportToExcel, exportToJSON, exportToPDF } from "../../utils/export";
import { formatDisplayMoney, formatMoney, getAccountancySummary, getDatedCategoryName, getEntryDisplayAmount, getEntryThsAmount, getEntryUsdAmount, groupAccountancyEntriesByCategory, normalizeAccountancyEntry } from "../../utils/accountancy";

export function AccountancyLiabilities() {
  const { accountancyEntries, selectedPropertyId, accountancyDisplayCurrency } = useAppContext();
  const summary = getAccountancySummary({ propertyId: selectedPropertyId, accountancyEntries, displayCurrency: accountancyDisplayCurrency });
  const liabilityEntries = accountancyEntries
    .filter(entry => entry.propertyId === selectedPropertyId && entry.type === "Liability" && entry.status === "Confirmed")
    .map(normalizeAccountancyEntry);
  const liabilityGroups = groupAccountancyEntriesByCategory(liabilityEntries, accountancyDisplayCurrency);

  const rows = liabilityEntries.map(entry => ({
    Date: entry.date,
    Category: getDatedCategoryName(entry.category, entry.date),
    Subcategories: entry.subcategoryBreakdown?.length
      ? entry.subcategoryBreakdown.map(item => `${item.name}: ${formatMoney(item.amount, entry.currency)}`).join(", ")
      : entry.subcategories?.join(", ") || "",
    Counterparty: entry.counterparty,
    Reference: entry.reference || "",
    OriginalAmount: entry.amount,
    Currency: entry.currency,
    FX_USD_THS: entry.fxUsdThs,
    FX_THS_USD: entry.fxThsUsd,
    AmountUSD: -getEntryUsdAmount(entry),
    AmountTHS: -getEntryThsAmount(entry),
    DisplayAmount: -getEntryDisplayAmount(entry, accountancyDisplayCurrency),
    Source: entry.source,
    Details: entry.description,
  }));

  const handleExport = (type: "csv" | "excel" | "json" | "pdf") => {
    if (type === "csv") exportToCSV(rows, "Liabilities");
    if (type === "excel") exportToExcel(rows, "Liabilities");
    if (type === "json") exportToJSON(rows, "Liabilities");
    if (type === "pdf") exportToPDF(rows, "Liabilities", "Liabilities");
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Liabilities</h1>
          <p className="text-muted-foreground">Confirmed liability lines for the active property. These feed the Balance Sheet.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AccountancyCurrencyFilter compact />
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")}><Download className="mr-2 h-4 w-4" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("excel")}>Excel</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("json")}>JSON</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>PDF</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label="Total Liabilities" value={formatDisplayMoney(summary.totalLiabilities, accountancyDisplayCurrency)} />
        <SummaryCard label="Confirmed Entries" value={String(liabilityEntries.length)} />
        <SummaryCard label="Liability Categories" value={String(liabilityGroups.length)} />
      </div>

      <AccountancyLedgerManager title="Manage Liability Ledger Entries" filter="Liability" />

      <CategoryPanel items={liabilityGroups} />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <Scale className="h-4 w-4 text-destructive" />
      </div>
      <p className="mt-2 text-2xl font-bold text-destructive">{value}</p>
    </div>
  );
}

function CategoryPanel({ items }: { items: ReturnType<typeof groupAccountancyEntriesByCategory> }) {
  const { accountancyDisplayCurrency } = useAppContext();
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="font-semibold">Liabilities by Category</h2>
      <div className="mt-4 space-y-2">
        {items.map(group => (
          <div key={group.category} className="rounded-md bg-muted/40 px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{group.category}</span>
              <span className="font-semibold text-destructive">-{formatDisplayMoney(group.total, accountancyDisplayCurrency)}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.keys(group.subcategories).map(subcategory => (
                <span key={subcategory} className="rounded-full bg-background px-2 py-1 text-xs text-muted-foreground">{subcategory}</span>
              ))}
            </div>
          </div>
        ))}
        {!items.length && <p className="text-sm text-muted-foreground">No confirmed liability entries yet.</p>}
      </div>
    </div>
  );
}
