import { Download, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useAppContext } from "../../context/AppContext";
import { Button } from "../../components/ui/button";
import { AccountancyLedgerManager } from "../../components/accountancy/AccountancyLedgerManager";
import { AccountancyCurrencyFilter } from "../../components/accountancy/AccountancyCurrencyFilter";
import { AccountancyDateRangeFilter } from "../../components/accountancy/AccountancyDateRangeFilter";
import { exportToCSV, exportToExcel, exportToJSON, exportToPDF } from "../../utils/export";
import { filterEntriesByDateRange, formatDisplayMoney, formatMoney, getAccountancySummary, getDatedCategoryName, getDefaultAccountancyDateRange, getEntryDisplayAmount, getEntryThsAmount, getEntryUsdAmount, normalizeAccountancyEntry } from "../../utils/accountancy";

export function AccountancyRevenues() {
  const { accountancyEntries, selectedPropertyId, accountancyDisplayCurrency } = useAppContext();
  const [dateRange, setDateRange] = useState(getDefaultAccountancyDateRange);

  const summary = getAccountancySummary({ propertyId: selectedPropertyId, accountancyEntries, displayCurrency: accountancyDisplayCurrency, dateRange });
  const revenueEntries = filterEntriesByDateRange(
    accountancyEntries.filter(entry => entry.propertyId === selectedPropertyId && entry.type === "Revenue" && entry.status === "Confirmed"),
    dateRange,
  )
    .map(normalizeAccountancyEntry);

  const rows = revenueEntries.map(entry => ({
    Date: entry.date,
    Category: getDatedCategoryName(entry.category, entry.date),
    Subcategories: entry.subcategoryBreakdown?.length
      ? entry.subcategoryBreakdown.map(item => `${item.name}: ${formatMoney(item.amount, entry.currency)}`).join(", ")
      : entry.subcategories?.join(", ") || "",
    ReservationID: entry.reservationId || "",
    CustomerInvoiceID: entry.customerInvoiceId || "",
    Counterparty: entry.counterparty,
    Reference: entry.reference || "",
    OriginalAmount: entry.amount,
    Currency: entry.currency,
    FX_USD_THS: entry.fxUsdThs,
    FX_THS_USD: entry.fxThsUsd,
    AmountUSD: getEntryUsdAmount(entry),
    AmountTHS: getEntryThsAmount(entry),
    DisplayAmount: getEntryDisplayAmount(entry, accountancyDisplayCurrency),
    Source: entry.source,
    Details: entry.description,
  }));

  const handleExport = (type: "csv" | "excel" | "json" | "pdf") => {
    if (type === "csv") exportToCSV(rows, "Revenues");
    if (type === "excel") exportToExcel(rows, "Revenues");
    if (type === "json") exportToJSON(rows, "Revenues");
    if (type === "pdf") exportToPDF(rows, "Revenues", "Revenues");
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Revenues</h1>
          <p className="text-muted-foreground">Confirmed revenue lines posted manually or through GenAI Assistant.</p>
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
        <SummaryCard label="Ledger Revenue" value={formatDisplayMoney(summary.ledgerRevenue, accountancyDisplayCurrency)} />
        <SummaryCard label="Confirmed Entries" value={String(revenueEntries.length)} />
        <SummaryCard label="Total Revenue" value={formatDisplayMoney(summary.totalRevenue, accountancyDisplayCurrency)} strong />
      </div>

      <AccountancyLedgerManager title="Manage Revenue Ledger Entries" filter="Revenue" />

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-auto">
          <table className="w-full min-w-[1280px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-sm uppercase tracking-wider text-muted-foreground">
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Category</th>
                <th className="p-4 font-medium">Subcategories</th>
                <th className="p-4 font-medium">Reservation ID</th>
                <th className="p-4 font-medium">Customer Invoice ID</th>
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
                  <td className="p-4 text-muted-foreground">{row.ReservationID || "-"}</td>
                  <td className="p-4 text-muted-foreground">{row.CustomerInvoiceID || "-"}</td>
                  <td className="p-4">{row.Counterparty}</td>
                  <td className="p-4 text-muted-foreground">{row.Reference || "-"}</td>
                  <td className="p-4 text-muted-foreground">{row.Source}</td>
                  <td className="p-4 text-muted-foreground">{row.Currency}</td>
                  <td className="p-4 text-muted-foreground">{Number(row.FX_USD_THS || 0).toFixed(6)}</td>
                  <td className="p-4 text-muted-foreground">{Number(row.FX_THS_USD || 0).toFixed(8)}</td>
                  <td className="p-4 text-right font-semibold text-green-600">{formatDisplayMoney(row.DisplayAmount, accountancyDisplayCurrency)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-muted-foreground">No revenue lines found.</td>
                </tr>
              )}
              <tr className="border-t border-border bg-muted/30">
                <td className="p-4 text-right font-bold" colSpan={11}>TOTAL REVENUE</td>
                <td className="p-4 text-right font-bold text-green-600">{formatDisplayMoney(summary.totalRevenue, accountancyDisplayCurrency)}</td>
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
        <TrendingUp className="h-4 w-4 text-green-600" />
      </div>
      <p className={`mt-2 text-2xl font-bold ${strong ? "text-green-700" : "text-green-600"}`}>{value}</p>
    </div>
  );
}
