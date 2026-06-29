import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import { Button } from "../../components/ui/button";
import { AccountancyCurrencyFilter } from "../../components/accountancy/AccountancyCurrencyFilter";
import { AccountancyDateRangeFilter } from "../../components/accountancy/AccountancyDateRangeFilter";
import { AccountancyLedgerManager } from "../../components/accountancy/AccountancyLedgerManager";
import { exportToCSV, exportToExcel, exportToJSON, exportToPDF } from "../../utils/export";
import {
  CategoryGroup,
  filterEntriesByDateRange,
  flattenCategoryGroups,
  formatDisplayMoney,
  getAccountancySummary,
  getDefaultAccountancyDateRange,
  groupAccountancyEntriesByCategory,
} from "../../utils/accountancy";

export function AccountancyBalance() {
  const { accountancyEntries, selectedPropertyId, accountancyDisplayCurrency } = useAppContext();
  const [dateRange, setDateRange] = useState(getDefaultAccountancyDateRange);
  const summary = getAccountancySummary({ propertyId: selectedPropertyId, accountancyEntries, displayCurrency: accountancyDisplayCurrency, dateRange });
  const confirmedEntries = filterEntriesByDateRange(
    accountancyEntries.filter(entry => entry.propertyId === selectedPropertyId && entry.status === "Confirmed"),
    dateRange,
  );
  const assetGroups = groupAccountancyEntriesByCategory(confirmedEntries.filter(entry => entry.type === "Asset"), accountancyDisplayCurrency);
  const liabilityGroups = groupAccountancyEntriesByCategory(confirmedEntries.filter(entry => entry.type === "Liability"), accountancyDisplayCurrency);

  const handleExport = (type: "csv" | "excel" | "json" | "pdf") => {
    const data = [
      ...flattenCategoryGroups(assetGroups, "Assets", 1),
      ...flattenCategoryGroups(liabilityGroups, "Liabilities", -1),
      { Section: "Result", Category: "Net Balance", Subcategory: "", Amount: summary.netBalance },
    ];

    if (type === "csv") exportToCSV(data, "Balance");
    if (type === "excel") exportToExcel(data, "Balance");
    if (type === "json") exportToJSON(data, "Balance");
    if (type === "pdf") exportToPDF(data, "Balance", "Balance Sheet");
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Balance Sheet</h1>
          <p className="text-muted-foreground">Assets and liabilities update automatically from confirmed Accountancy ledger entries.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AccountancyDateRangeFilter compact value={dateRange} onChange={setDateRange} />
          <AccountancyCurrencyFilter compact />
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("excel")}>Excel</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("json")}>JSON</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>PDF</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <BalancePanel title="Assets" groups={assetGroups} total={summary.totalAssets} tone="positive" displayCurrency={accountancyDisplayCurrency} />
        <BalancePanel title="Liabilities" groups={liabilityGroups} total={summary.totalLiabilities} tone="negative" displayCurrency={accountancyDisplayCurrency} />
      </div>

      <div className={`rounded-lg border-2 p-6 shadow-sm ${summary.netBalance >= 0 ? "border-green-500/30 bg-green-500/10 text-green-800" : "border-red-500/30 bg-red-500/10 text-red-800"}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold">Net Balance</h2>
          <span className="text-3xl font-bold">{summary.netBalance < 0 ? `-${formatDisplayMoney(Math.abs(summary.netBalance), accountancyDisplayCurrency)}` : formatDisplayMoney(summary.netBalance, accountancyDisplayCurrency)}</span>
        </div>
      </div>

      <AccountancyLedgerManager title="Manage Balance Source Entries" filter="All" allowedTypes={["Asset", "Liability"]} />
    </div>
  );
}

function BalancePanel({
  title,
  groups,
  total,
  tone,
  displayCurrency,
}: {
  title: string;
  groups: CategoryGroup[];
  total: number;
  tone: "positive" | "negative";
  displayCurrency: "USD" | "TZS";
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const toneClass = tone === "positive" ? "text-green-600" : "text-destructive";
  const sign = tone === "negative" ? "-" : "";

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border p-5">
        <h2 className={`text-xl font-bold ${toneClass}`}>{title}</h2>
      </div>
      <div className="divide-y divide-border">
        {groups.map(group => {
          const isOpen = openGroups[group.category] ?? true;
          return (
            <div key={group.category}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/40"
                onClick={() => setOpenGroups(current => ({ ...current, [group.category]: !isOpen }))}
              >
                <span className="flex min-w-0 items-center gap-2 font-semibold">
                  {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  <span className="truncate">{group.category}</span>
                </span>
                <span className={`shrink-0 font-semibold ${toneClass}`}>{sign}{formatDisplayMoney(group.total, displayCurrency)}</span>
              </button>
              {isOpen && (
                <div className="space-y-2 px-8 pb-4">
                  {Object.entries(group.subcategories).map(([subcategory, amount]) => (
                    <div key={subcategory} className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate text-xs text-muted-foreground">{subcategory}</span>
                      <span className={`text-xs font-semibold ${toneClass}`}>{sign}{formatDisplayMoney(amount, displayCurrency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {!groups.length && <p className="p-6 text-sm text-muted-foreground">No confirmed {title.toLowerCase()} entries yet.</p>}
      </div>
      <div className="flex justify-between border-t border-border bg-muted/30 p-4">
        <span className="font-bold">Total {title}</span>
        <span className={`font-bold ${toneClass}`}>{sign}{formatDisplayMoney(total, displayCurrency)}</span>
      </div>
    </div>
  );
}
