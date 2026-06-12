import { Bot, Download, TrendingUp } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import { Button } from "../../components/ui/button";
import { AccountancyLedgerManager } from "../../components/accountancy/AccountancyLedgerManager";
import { exportToCSV, exportToExcel, exportToJSON } from "../../utils/export";
import { formatMoney, getAccountancySummary } from "../../utils/accountancy";

export function AccountancyRevenues() {
  const { reservations, accountancyEntries, supplyRequests, clients, selectedPropertyId } = useAppContext();

  const summary = getAccountancySummary({ propertyId: selectedPropertyId, reservations, supplyRequests, accountancyEntries });
  const propertyReservations = reservations.filter(reservation => reservation.propertyId === selectedPropertyId && reservation.status !== "Cancelled");
  const revenueEntries = accountancyEntries.filter(entry => entry.propertyId === selectedPropertyId && entry.type === "Revenue" && entry.status === "Confirmed");

  const rows = [
    ...propertyReservations.map(reservation => ({
      Date: reservation.checkIn,
      Category: "Bookings",
      Counterparty: clients.find(client => client.id === reservation.clientId)?.name || "Guest",
      Reference: reservation.id,
      Amount: reservation.price,
      Source: "Reservations",
      Details: `${reservation.checkIn} to ${reservation.checkOut}`,
    })),
    ...revenueEntries.map(entry => ({
      Date: entry.date,
      Category: entry.category,
      Counterparty: entry.counterparty,
      Reference: entry.reference || "",
      Amount: entry.amount,
      Source: entry.source,
      Details: entry.description,
    })),
  ];

  const handleExport = (type: "csv" | "excel" | "json") => {
    if (type === "csv") exportToCSV(rows, "Revenues");
    if (type === "excel") exportToExcel(rows, "Revenues");
    if (type === "json") exportToJSON(rows, "Revenues");
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Revenues</h1>
          <p className="text-muted-foreground">Confirmed revenue lines from reservations and posted proof-of-payment documents.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")}><Download className="mr-2 h-4 w-4" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("excel")}>Excel</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("json")}>JSON</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Bookings Revenue" value={formatMoney(summary.bookingsRevenue)} />
        <SummaryCard label="Ledger Revenue" value={formatMoney(summary.ledgerRevenue)} icon />
        <SummaryCard label="Total Revenue" value={formatMoney(summary.totalRevenue)} strong />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-sm text-muted-foreground uppercase tracking-wider">
              <th className="p-4 font-medium">Date</th>
              <th className="p-4 font-medium">Category</th>
              <th className="p-4 font-medium">Counterparty</th>
              <th className="p-4 font-medium">Reference</th>
              <th className="p-4 font-medium">Source</th>
              <th className="p-4 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.Reference}-${index}`} className="border-b border-border">
                <td className="p-4 text-muted-foreground">{row.Date}</td>
                <td className="p-4 font-medium">{row.Category}</td>
                <td className="p-4">{row.Counterparty}</td>
                <td className="p-4 text-muted-foreground">{row.Reference || "-"}</td>
                <td className="p-4 text-muted-foreground">{row.Source}</td>
                <td className="p-4 text-right font-semibold text-green-600">{formatMoney(row.Amount)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">No revenue lines found.</td>
              </tr>
            )}
            <tr className="bg-muted/30 border-t border-border">
              <td className="p-4 font-bold text-right" colSpan={5}>TOTAL REVENUE</td>
              <td className="p-4 font-bold text-right text-green-600">{formatMoney(summary.totalRevenue)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <AccountancyLedgerManager title="Manage Revenue Ledger Entries" filter="Revenue" />
    </div>
  );
}

function SummaryCard({ label, value, strong, icon }: { label: string; value: string; strong?: boolean; icon?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        {icon ? <Bot className="h-4 w-4 text-primary" /> : <TrendingUp className="h-4 w-4 text-green-600" />}
      </div>
      <p className={`mt-2 text-2xl font-bold ${strong ? "text-green-700" : "text-green-600"}`}>{value}</p>
    </div>
  );
}
