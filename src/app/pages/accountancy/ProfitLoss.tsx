import { useState } from "react";
import { ChevronDown, ChevronRight, Download, Scale } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import { Button } from "../../components/ui/button";
import { AccountancyLedgerManager } from "../../components/accountancy/AccountancyLedgerManager";
import { exportToCSV, exportToExcel, exportToJSON } from "../../utils/export";
import {
  CategoryGroup,
  flattenCategoryGroups,
  formatMoney,
  getAccountancySummary,
  groupAccountancyEntriesByCategory,
} from "../../utils/accountancy";

export function AccountancyProfitLoss() {
  const { accountancyEntries, selectedPropertyId } = useAppContext();
  const summary = getAccountancySummary({ propertyId: selectedPropertyId, accountancyEntries });
  const confirmedEntries = accountancyEntries.filter(entry => entry.propertyId === selectedPropertyId && entry.status === "Confirmed");
  const revenueGroups = groupAccountancyEntriesByCategory(confirmedEntries.filter(entry => entry.type === "Revenue"));
  const expenseGroups = groupAccountancyEntriesByCategory(confirmedEntries.filter(entry => entry.type === "Expense"));

  const rows = [
    ...flattenCategoryGroups(revenueGroups, "Revenue", 1),
    ...flattenCategoryGroups(expenseGroups, "Expenses", -1),
    { Section: "Result", Category: "Net Profit / Loss", Subcategory: "", Amount: summary.netProfit },
  ];

  const handleExport = (type: "csv" | "excel" | "json") => {
    if (type === "csv") exportToCSV(rows, "ProfitLoss");
    if (type === "excel") exportToExcel(rows, "ProfitLoss");
    if (type === "json") exportToJSON(rows, "ProfitLoss");
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Profit & Loss (P&L)</h1>
          <p className="text-muted-foreground">Automatically updated from confirmed Accountancy revenue and expense entries.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")}><Download className="mr-2 h-4 w-4" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("excel")}>Excel</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("json")}>JSON</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <StatementPanel title="Revenue" groups={revenueGroups} total={summary.totalRevenue} tone="positive" />
        <StatementPanel title="Expenses" groups={expenseGroups} total={summary.totalExpenses} tone="negative" />
      </div>

      <div className={`rounded-xl border-2 p-6 shadow-sm ${summary.netProfit >= 0 ? "border-green-500/30 bg-green-500/10 text-green-800" : "border-red-500/30 bg-red-500/10 text-red-800"}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider">Current Result</p>
            <p className="mt-1 text-sm">This figure is recalculated whenever confirmed revenue or expense ledger entries change.</p>
          </div>
          <div className="flex items-center gap-3">
            <Scale className="h-6 w-6" />
            <span className="text-3xl font-bold">{summary.netProfit < 0 ? `-${formatMoney(Math.abs(summary.netProfit))}` : formatMoney(summary.netProfit)}</span>
          </div>
        </div>
      </div>

      <AccountancyLedgerManager title="Manage P&L Source Entries" filter="All" allowedTypes={["Revenue", "Expense"]} />
    </div>
  );
}

function StatementPanel({
  title,
  groups,
  total,
  tone,
}: {
  title: string;
  groups: CategoryGroup[];
  total: number;
  tone: "positive" | "negative";
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const toneClass = tone === "positive" ? "text-green-600" : "text-destructive";
  const sign = tone === "negative" ? "-" : "";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
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
                <span className={`shrink-0 font-semibold ${toneClass}`}>{sign}{formatMoney(group.total)}</span>
              </button>
              {isOpen && (
                <div className="space-y-2 px-8 pb-4">
                  {Object.entries(group.subcategories).map(([subcategory, amount]) => (
                    <div key={subcategory} className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate text-xs text-muted-foreground">{subcategory}</span>
                      <span className={`text-xs font-semibold ${toneClass}`}>{sign}{formatMoney(amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {!groups.length && <p className="p-6 text-sm text-muted-foreground">No confirmed {title.toLowerCase()} entries yet.</p>}
      </div>
      <div className="flex items-center justify-between border-t border-border bg-muted/30 p-4">
        <span className="font-bold">Total {title}</span>
        <span className={`font-bold ${toneClass}`}>{sign}{formatMoney(total)}</span>
      </div>
    </div>
  );
}
