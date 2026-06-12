import { useAppContext } from "../../context/AppContext";
import { Button } from "../../components/ui/button";
import { AccountancyLedgerManager } from "../../components/accountancy/AccountancyLedgerManager";
import { exportToCSV, exportToExcel, exportToJSON } from "../../utils/export";
import { formatMoney, getAccountancySummary } from "../../utils/accountancy";

export function AccountancyBalance() {
  const { reservations, supplyRequests, accountancyEntries, selectedPropertyId } = useAppContext();
  const summary = getAccountancySummary({ propertyId: selectedPropertyId, reservations, supplyRequests, accountancyEntries });

  const handleExport = (type: "csv" | "excel" | "json") => {
    const data = [
      { Category: "Total Assets", Amount: summary.totalRevenue },
      { Category: "Total Liabilities", Amount: -summary.totalExpenses },
      { Category: "Net Balance", Amount: summary.netProfit },
    ];

    if (type === "csv") exportToCSV(data, "Balance");
    if (type === "excel") exportToExcel(data, "Balance");
    if (type === "json") exportToJSON(data, "Balance");
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Balance Sheet</h1>
          <p className="text-muted-foreground">Balance updates automatically when revenues, expenses, or GenAI postings are confirmed.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("excel")}>Excel</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("json")}>JSON</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-bold text-green-600 mb-4 border-b border-border pb-2">Assets</h2>
          <div className="space-y-3">
            <Line label="Bookings" value={formatMoney(summary.bookingsRevenue)} />
            <Line label="Posted revenue documents" value={formatMoney(summary.ledgerRevenue)} />
            <div className="pt-4 mt-4 border-t border-border flex justify-between">
              <span className="font-bold">Total Assets</span>
              <span className="font-bold text-green-600">{formatMoney(summary.totalRevenue)}</span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-bold text-destructive mb-4 border-b border-border pb-2">Liabilities</h2>
          <div className="space-y-3">
            <Line label="Supply requests" value={formatMoney(summary.supplyExpenses)} />
            <Line label="Posted supplier invoices" value={formatMoney(summary.ledgerExpenses)} />
            <div className="pt-4 mt-4 border-t border-border flex justify-between">
              <span className="font-bold">Total Liabilities</span>
              <span className="font-bold text-destructive">{formatMoney(summary.totalExpenses)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={`p-6 rounded-lg border-2 flex items-center justify-between shadow-sm ${
        summary.netProfit >= 0 ? "bg-green-500/10 border-green-500/30 text-green-800" : "bg-red-500/10 border-red-500/30 text-red-800"
      }`}>
        <h2 className="text-2xl font-bold">Net Balance</h2>
        <span className="text-3xl font-bold">{summary.netProfit < 0 ? `-${formatMoney(Math.abs(summary.netProfit))}` : formatMoney(summary.netProfit)}</span>
      </div>

      <AccountancyLedgerManager title="Manage Balance Source Entries" filter="All" />
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
