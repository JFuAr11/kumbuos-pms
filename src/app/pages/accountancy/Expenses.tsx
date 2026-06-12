import { Bot, Download, TrendingDown } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import { Button } from "../../components/ui/button";
import { AccountancyLedgerManager } from "../../components/accountancy/AccountancyLedgerManager";
import { exportToCSV, exportToExcel, exportToJSON } from "../../utils/export";
import { formatMoney, getAccountancySummary, groupAccountancyEntriesByCategory } from "../../utils/accountancy";

export function AccountancyExpenses() {
  const { supplyRequests, accountancyEntries, reservations, selectedPropertyId } = useAppContext();

  const summary = getAccountancySummary({ propertyId: selectedPropertyId, reservations, supplyRequests, accountancyEntries });
  const propertyExpenses = supplyRequests.filter(request => request.propertyId === selectedPropertyId);
  const expenseEntries = accountancyEntries.filter(entry => entry.propertyId === selectedPropertyId && entry.type === "Expense" && entry.status === "Confirmed");

  const supplyExpensesByCategory = propertyExpenses.reduce((acc, request) => {
    acc[request.category] = (acc[request.category] || 0) + request.amount;
    return acc;
  }, {} as Record<string, number>);
  const ledgerExpensesByCategory = groupAccountancyEntriesByCategory(expenseEntries);

  const rows = [
    ...propertyExpenses.map(request => ({
      Date: request.date,
      Category: request.category,
      Counterparty: "Internal supply request",
      Reference: request.id,
      Amount: request.amount,
      Source: "Supply Requests",
      Details: request.description,
    })),
    ...expenseEntries.map(entry => ({
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
    if (type === "csv") exportToCSV(rows, "Expenses");
    if (type === "excel") exportToExcel(rows, "Expenses");
    if (type === "json") exportToJSON(rows, "Expenses");
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Expenses</h1>
          <p className="text-muted-foreground">Supplier invoices and operating purchases posted from supply requests or GenAI review.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")}><Download className="mr-2 h-4 w-4" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("excel")}>Excel</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("json")}>JSON</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Supply Requests" value={formatMoney(summary.supplyExpenses)} />
        <SummaryCard label="Ledger Expenses" value={formatMoney(summary.ledgerExpenses)} icon />
        <SummaryCard label="Total Expenses" value={formatMoney(summary.totalExpenses)} strong />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryPanel title="Supply Expenses by Category" items={supplyExpensesByCategory} />
        <CategoryPanel title="Ledger Expenses by Category" items={ledgerExpensesByCategory} />
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
                <td className="p-4 text-right font-semibold text-destructive">-{formatMoney(row.Amount)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">No expenses found.</td>
              </tr>
            )}
            <tr className="bg-muted/30 border-t border-border">
              <td className="p-4 font-bold text-right" colSpan={5}>TOTAL EXPENSES</td>
              <td className="p-4 font-bold text-right text-destructive">-{formatMoney(summary.totalExpenses)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <AccountancyLedgerManager title="Manage Expense Ledger Entries" filter="Expense" />
    </div>
  );
}

function SummaryCard({ label, value, strong, icon }: { label: string; value: string; strong?: boolean; icon?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        {icon ? <Bot className="h-4 w-4 text-primary" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
      </div>
      <p className={`mt-2 text-2xl font-bold ${strong ? "text-red-700" : "text-destructive"}`}>{value}</p>
    </div>
  );
}

function CategoryPanel({ title, items }: { title: string; items: Record<string, number> }) {
  const rows = Object.entries(items);
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-4 space-y-2">
        {rows.map(([category, amount]) => (
          <div key={category} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
            <span>{category}</span>
            <span className="font-semibold text-destructive">-{formatMoney(amount)}</span>
          </div>
        ))}
        {!rows.length && <p className="text-sm text-muted-foreground">No confirmed entries yet.</p>}
      </div>
    </div>
  );
}
