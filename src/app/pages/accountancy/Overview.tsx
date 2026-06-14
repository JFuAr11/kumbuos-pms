import { Bot, Scale, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import { formatMoney, getAccountancySummary } from "../../utils/accountancy";

export function AccountancyOverview() {
  const { accountancyEntries, selectedPropertyId } = useAppContext();
  const propertyEntries = accountancyEntries.filter(entry => entry.propertyId === selectedPropertyId);
  const summary = getAccountancySummary({ propertyId: selectedPropertyId, accountancyEntries });
  const aiEntries = propertyEntries.filter(entry => entry.source === "GenAI Assistant");

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold">Accountancy Overview</h1>
        <p className="text-muted-foreground">Live financial view from confirmed Accountancy ledger entries for the active property.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-5">
        <Metric title="Total Revenues" value={formatMoney(summary.totalRevenue)} tone="positive" icon={TrendingUp} />
        <Metric title="Total Expenses" value={formatMoney(summary.totalExpenses)} tone="negative" icon={TrendingDown} />
        <Metric title="Net Profit" value={formatMoney(summary.netProfit)} tone={summary.netProfit >= 0 ? "positive" : "negative"} icon={Scale} />
        <Metric title="Net Balance" value={formatMoney(summary.netBalance)} tone={summary.netBalance >= 0 ? "positive" : "negative"} icon={Wallet} />
        <Metric title="AI Posted Entries" value={String(aiEntries.length)} tone="neutral" icon={Bot} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Profit & Loss Source</h2>
          <div className="mt-4 space-y-3">
            <Line label="Confirmed ledger revenue" value={formatMoney(summary.ledgerRevenue)} />
            <Line label="Confirmed ledger expenses" value={`-${formatMoney(summary.ledgerExpenses)}`} />
            <Line label="Net profit / loss" value={formatMoney(summary.netProfit)} strong />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Balance Source</h2>
          <div className="mt-4 space-y-3">
            <Line label="Confirmed assets" value={formatMoney(summary.totalAssets)} />
            <Line label="Confirmed liabilities" value={`-${formatMoney(summary.totalLiabilities)}`} />
            <Line label="Net balance" value={formatMoney(summary.netBalance)} strong />
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ title, value, tone, icon: Icon }: { title: string; value: string; tone: "positive" | "negative" | "neutral"; icon: typeof TrendingUp }) {
  const toneClass = tone === "positive" ? "text-green-600" : tone === "negative" ? "text-destructive" : "text-primary";
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
        <Icon className={`h-5 w-5 ${toneClass}`} />
      </div>
      <p className={`mt-3 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 ${strong ? "font-semibold" : ""}`}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
