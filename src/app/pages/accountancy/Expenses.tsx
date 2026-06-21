import { Download, TrendingDown } from "lucide-react";
import { useState } from "react";
import { useAppContext } from "../../context/AppContext";
import { Button } from "../../components/ui/button";
import { AccountancyLedgerManager } from "../../components/accountancy/AccountancyLedgerManager";
import { AccountancyCurrencyFilter } from "../../components/accountancy/AccountancyCurrencyFilter";
import { AccountancyDateRangeFilter } from "../../components/accountancy/AccountancyDateRangeFilter";
import { exportToCSV, exportToExcel, exportToJSON, exportToPDF } from "../../utils/export";
import { filterEntriesByDateRange, formatDisplayMoney, formatMoney, getAccountancySummary, getDatedCategoryName, getDefaultAccountancyDateRange, getEntryDisplayAmount, getEntryThsAmount, getEntryUsdAmount, groupAccountancyEntriesByCategory, normalizeAccountancyEntry } from "../../utils/accountancy";

export function AccountancyExpenses() {
  const { accountancyEntries, selectedPropertyId, accountancyDisplayCurrency } = useAppContext();
  const [dateRange, setDateRange] = useState(getDefaultAccountancyDateRange);

  const summary = getAccountancySummary({ propertyId: selectedPropertyId, accountancyEntries, displayCurrency: accountancyDisplayCurrency, dateRange });
  const expenseEntries = filterEntriesByDateRange(
    accountancyEntries.filter(entry => entry.propertyId === selectedPropertyId && entry.type === "Expense" && entry.status === "Confirmed"),
    dateRange,
  )
    .map(normalizeAccountancyEntry);
  const ledgerExpensesByCategory = groupAccountancyEntriesByCategory(expenseEntries, accountancyDisplayCurrency);

  const rows = expenseEntries.map(entry => ({
    Date: entry.date,
    Category: getDatedCategoryName(entry.category, entry.date),
    Subcategories: entry.subcategoryBreakdown?.length
      ? entry.subcategoryBreakdown.map(item => `${item.name}: ${formatMoney(item.amount, entry.currency)}`).join(", ")
      : entry.subcategories?.join(", ") || "",
    SupplierInvoiceID: entry.supplierInvoiceId || "",
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
    if (type === "csv") exportToCSV(rows, "Expenses");
    if (type === "excel") exportToExcel(rows, "Expenses");
    if (type === "json") exportToJSON(rows, "Expenses");
    if (type === "pdf") exportToPDF(rows, "Expenses", "Expenses");
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Expenses</h1>
          <p className="text-muted-foreground">Confirmed supplier invoices and expense records posted manually or through GenAI Assistant.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AccountancyDateRangeFilter compact value={dateRange} onChange={setDateRange} />
          <AccountancyCurrencyFilter compact />
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")}><Download className="mr-2 h-4 w-4" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("excel")}>Excel</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("json")}>JSON</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>PDF</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label="Ledger Expenses" value={`-${formatDisplayMoney(summary.ledgerExpenses, accountancyDisplayCurrency)}`} />
        <SummaryCard label="Confirmed Entries" value={String(expenseEntries.length)} />
        <SummaryCard label="Total Expenses" value={`-${formatDisplayMoney(summary.totalExpenses, accountancyDisplayCurrency)}`} strong />
      </div>

      <AccountancyLedgerManager title="Manage Expense Ledger Entries" filter="Expense" />

      <CategoryPanel title="Expenses by Category" items={ledgerExpensesByCategory} />

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-auto">
          <table className="w-full min-w-[1240px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-sm uppercase tracking-wider text-muted-foreground">
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Category</th>
                <th className="p-4 font-medium">Subcategories</th>
                <th className="p-4 font-medium">Supplier Invoice ID</th>
                <th className="p-4 font-medium">Counterparty</th>
                <th className="p-4 font-medium">Reference</th>
                <th className="p-4 font-medium">Source</th>
                <th className="p-4 font-medium">Currency</th>
                <th className="p-4 font-medium">FX_USD_THS</th>
                <th className="p-4 font-medium">FX_THS_USD</th>
                <th className="p-4 text-right font-medium">{accountancyDisplayCurrency}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.Reference}-${index}`} className="border-b border-border">
                  <td className="p-4 text-muted-foreground">{row.Date}</td>
                  <td className="p-4 font-medium">{row.Category}</td>
                  <td className="p-4 text-xs text-muted-foreground">{row.Subcategories || "Unassigned"}</td>
                  <td className="p-4 text-muted-foreground">{row.SupplierInvoiceID || "-"}</td>
                  <td className="p-4">{row.Counterparty}</td>
                  <td className="p-4 text-muted-foreground">{row.Reference || "-"}</td>
                  <td className="p-4 text-muted-foreground">{row.Source}</td>
                  <td className="p-4 text-muted-foreground">{row.Currency}</td>
                  <td className="p-4 text-muted-foreground">{Number(row.FX_USD_THS || 0).toFixed(6)}</td>
                  <td className="p-4 text-muted-foreground">{Number(row.FX_THS_USD || 0).toFixed(8)}</td>
                  <td className="p-4 text-right font-semibold text-destructive">-{formatDisplayMoney(Math.abs(row.DisplayAmount), accountancyDisplayCurrency)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-muted-foreground">No expenses found.</td>
                </tr>
              )}
              <tr className="border-t border-border bg-muted/30">
                <td className="p-4 text-right font-bold" colSpan={10}>TOTAL EXPENSES</td>
                <td className="p-4 text-right font-bold text-destructive">-{formatDisplayMoney(summary.totalExpenses, accountancyDisplayCurrency)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <TrendingDown className="h-4 w-4 text-destructive" />
      </div>
      <p className={`mt-2 text-2xl font-bold ${strong ? "text-red-700" : "text-destructive"}`}>{value}</p>
    </div>
  );
}

function CategoryPanel({ title, items }: { title: string; items: ReturnType<typeof groupAccountancyEntriesByCategory> }) {
  const { accountancyDisplayCurrency } = useAppContext();
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
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
        {!items.length && <p className="text-sm text-muted-foreground">No confirmed entries yet.</p>}
      </div>
    </div>
  );
}
