import { Download, Scale } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import { Button } from "../../components/ui/button";
import { AccountancyLedgerManager } from "../../components/accountancy/AccountancyLedgerManager";
import { exportToCSV, exportToExcel, exportToJSON } from "../../utils/export";
import { formatMoney, getAccountancySummary } from "../../utils/accountancy";

export function AccountancyProfitLoss() {
  const { reservations, supplyRequests, accountancyEntries, selectedPropertyId } = useAppContext();
  const summary = getAccountancySummary({ propertyId: selectedPropertyId, reservations, supplyRequests, accountancyEntries });

  const rows = [
    { Section: "Revenue", Line: "Reservations", Amount: summary.bookingsRevenue },
    { Section: "Revenue", Line: "Posted revenue documents", Amount: summary.ledgerRevenue },
    { Section: "Expenses", Line: "Supply requests", Amount: -summary.supplyExpenses },
    { Section: "Expenses", Line: "Posted supplier invoices", Amount: -summary.ledgerExpenses },
    { Section: "Result", Line: "Net Profit / Loss", Amount: summary.netProfit },
  ];

  const handleExport = (type: "csv" | "excel" | "json") => {
    if (type === "csv") exportToCSV(rows, "ProfitLoss");
    if (type === "excel") exportToExcel(rows, "ProfitLoss");
    if (type === "json") exportToJSON(rows, "ProfitLoss");
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Profit & Loss (P&L)</h1>
          <p className="text-muted-foreground">Automatically updated from reservations, GenAI postings, and operating expenses.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")}><Download className="mr-2 h-4 w-4" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("excel")}>Excel</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("json")}>JSON</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-sm text-muted-foreground uppercase tracking-wider">
              <th className="p-4 font-medium">Section</th>
              <th className="p-4 font-medium">Line</th>
              <th className="p-4 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 4).map(row => (
              <tr key={`${row.Section}-${row.Line}`} className="border-b border-border">
                <td className="p-4 font-medium">{row.Section}</td>
                <td className="p-4 text-muted-foreground">{row.Line}</td>
                <td className={`p-4 text-right font-semibold ${row.Amount >= 0 ? "text-green-600" : "text-destructive"}`}>
                  {row.Amount < 0 ? `-${formatMoney(Math.abs(row.Amount))}` : formatMoney(row.Amount)}
                </td>
              </tr>
            ))}
            <tr className="bg-muted/30 border-t border-border">
              <td className="p-4 font-bold text-right" colSpan={2}>NET PROFIT / LOSS</td>
              <td className={`p-4 text-right text-xl font-bold ${summary.netProfit >= 0 ? "text-green-700" : "text-destructive"}`}>
                {summary.netProfit < 0 ? `-${formatMoney(Math.abs(summary.netProfit))}` : formatMoney(summary.netProfit)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={`rounded-xl border-2 p-6 shadow-sm ${summary.netProfit >= 0 ? "border-green-500/30 bg-green-500/10 text-green-800" : "border-red-500/30 bg-red-500/10 text-red-800"}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider">Current Result</p>
            <p className="mt-1 text-sm">This figure feeds the Balance view automatically.</p>
          </div>
          <div className="flex items-center gap-3">
            <Scale className="h-6 w-6" />
            <span className="text-3xl font-bold">{summary.netProfit < 0 ? `-${formatMoney(Math.abs(summary.netProfit))}` : formatMoney(summary.netProfit)}</span>
          </div>
        </div>
      </div>

      <AccountancyLedgerManager title="Manage P&L Source Entries" filter="All" />
    </div>
  );
}
