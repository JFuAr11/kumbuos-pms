import { Bot, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import { formatMoney, getAccountancySummary } from "../../utils/accountancy";

export function AccountancyOverview() {
  const { reservations, supplyRequests, accountancyEntries, selectedPropertyId } = useAppContext();
  const summary = getAccountancySummary({ propertyId: selectedPropertyId, reservations, supplyRequests, accountancyEntries });

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Accountancy Overview</h1>
        <p className="text-muted-foreground">Live financial view from reservations, posted GenAI entries, and operating expenses.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Metric title="Total Revenues" value={formatMoney(summary.totalRevenue)} tone="positive" icon={TrendingUp} />
        <Metric title="Total Expenses" value={formatMoney(summary.totalExpenses)} tone="negative" icon={TrendingDown} />
        <Metric title="Net Profit" value={formatMoney(summary.netProfit)} tone={summary.netProfit >= 0 ? "positive" : "negative"} icon={Scale} />
        <Metric title="AI Posted Entries" value={String(accountancyEntries.filter(entry => entry.source === "GenAI Assistant").length)} tone="neutral" icon={Bot} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Revenue Composition</h2>
          <div className="mt-4 space-y-3">
            <Line label="Reservation revenue" value={formatMoney(summary.bookingsRevenue)} />
            <Line label="Confirmed ledger revenue" value={formatMoney(summary.ledgerRevenue)} />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Expense Composition</h2>
          <div className="mt-4 space-y-3">
            <Line label="Supply requests" value={formatMoney(summary.supplyExpenses)} />
            <Line label="Confirmed ledger expenses" value={formatMoney(summary.ledgerExpenses)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ title, value, tone, icon: Icon }: { title: string; value: string; tone: "positive" | "negative" | "neutral"; icon: typeof TrendingUp }) {
  const toneClass = tone === "positive" ? "text-green-600" : tone === "negative" ? "text-destructive" : "text-primary";
  return (
    <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
        <Icon className={`h-5 w-5 ${toneClass}`} />
      </div>
      <p className={`mt-3 text-3xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
