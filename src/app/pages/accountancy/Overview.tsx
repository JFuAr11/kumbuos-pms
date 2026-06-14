import { Bot, Scale, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AccountancyEntry } from "../../context/AppContext";
import { useAppContext } from "../../context/AppContext";
import {
  formatMoney,
  getAccountancySummary,
  getConfirmedAccountancyEntries,
  groupAccountancyEntriesByCategory,
} from "../../utils/accountancy";

type ChartRow = Record<string, string | number>;

export function AccountancyOverview() {
  const { accountancyEntries, selectedPropertyId } = useAppContext();
  const confirmedEntries = getConfirmedAccountancyEntries({ propertyId: selectedPropertyId, accountancyEntries });
  const propertyEntries = accountancyEntries.filter(entry => entry.propertyId === selectedPropertyId);
  const summary = getAccountancySummary({ propertyId: selectedPropertyId, accountancyEntries });
  const aiEntries = propertyEntries.filter(entry => entry.source === "GenAI Assistant");

  const revenueEntries = confirmedEntries.filter(entry => entry.type === "Revenue");
  const expenseEntries = confirmedEntries.filter(entry => entry.type === "Expense");
  const assetEntries = confirmedEntries.filter(entry => entry.type === "Asset");
  const liabilityEntries = confirmedEntries.filter(entry => entry.type === "Liability");

  const pnlCategoryRows = mergeCategoryGroups([
    { label: "Revenue", entries: revenueEntries },
    { label: "Expenses", entries: expenseEntries },
  ]);
  const balanceCategoryRows = mergeCategoryGroups([
    { label: "Assets", entries: assetEntries },
    { label: "Liabilities", entries: liabilityEntries },
  ]);
  const monthlyRows = buildMonthlyRows(confirmedEntries);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold">Accountancy Overview</h1>
        <p className="text-muted-foreground">
          Overview is calculated from Profit & Loss and Balance data for the active property.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-5">
        <Metric title="P&L Revenues" value={formatMoney(summary.totalRevenue)} tone="positive" icon={TrendingUp} />
        <Metric title="P&L Expenses" value={formatMoney(summary.totalExpenses)} tone="negative" icon={TrendingDown} />
        <Metric title="P&L Net Profit" value={formatMoney(summary.netProfit)} tone={summary.netProfit >= 0 ? "positive" : "negative"} icon={Scale} />
        <Metric title="Balance Net Position" value={formatMoney(summary.netBalance)} tone={summary.netBalance >= 0 ? "positive" : "negative"} icon={Wallet} />
        <Metric title="AI Posted Entries" value={String(aiEntries.length)} tone="neutral" icon={Bot} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Profit & Loss Source</h2>
          <p className="mt-1 text-sm text-muted-foreground">Fed only by Revenues and Expenses.</p>
          <div className="mt-4 space-y-3">
            <Line label="Confirmed revenue entries" value={formatMoney(summary.ledgerRevenue)} />
            <Line label="Confirmed expense entries" value={`-${formatMoney(summary.ledgerExpenses)}`} />
            <Line label="Net profit / loss" value={formatMoney(summary.netProfit)} strong />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Balance Source</h2>
          <p className="mt-1 text-sm text-muted-foreground">Fed only by Assets and Liabilities.</p>
          <div className="mt-4 space-y-3">
            <Line label="Confirmed asset entries" value={formatMoney(summary.totalAssets)} />
            <Line label="Confirmed liability entries" value={`-${formatMoney(summary.totalLiabilities)}`} />
            <Line label="Net balance" value={formatMoney(summary.netBalance)} strong />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Profit & Loss by Category" description="Histogram of revenue and expense categories.">
          <ResponsiveContainer width="100%" height={320}>
            <RechartsBarChart data={pnlCategoryRows} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="category" angle={-20} textAnchor="end" height={70} interval={0} tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={compactMoney} width={70} />
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
              <Legend />
              <Bar dataKey="Revenue" fill="#2f8f5b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expenses" fill="#b94a48" radius={[4, 4, 0, 0]} />
            </RechartsBarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Balance by Category" description="Histogram of asset and liability categories.">
          <ResponsiveContainer width="100%" height={320}>
            <RechartsBarChart data={balanceCategoryRows} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="category" angle={-20} textAnchor="end" height={70} interval={0} tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={compactMoney} width={70} />
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
              <Legend />
              <Bar dataKey="Assets" fill="#4f7f9f" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Liabilities" fill="#9b6b43" radius={[4, 4, 0, 0]} />
            </RechartsBarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Monthly Accounting Trend" description="Time series for P&L and Balance movements by entry date.">
        <ResponsiveContainer width="100%" height={360}>
          <AreaChart data={monthlyRows} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={compactMoney} width={70} />
            <Tooltip formatter={(value) => formatMoney(Number(value))} />
            <Legend />
            <Area type="monotone" dataKey="Revenue" stroke="#2f8f5b" fill="#2f8f5b" fillOpacity={0.18} />
            <Area type="monotone" dataKey="Expenses" stroke="#b94a48" fill="#b94a48" fillOpacity={0.15} />
            <Area type="monotone" dataKey="Assets" stroke="#4f7f9f" fill="#4f7f9f" fillOpacity={0.15} />
            <Area type="monotone" dataKey="Liabilities" stroke="#9b6b43" fill="#9b6b43" fillOpacity={0.15} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
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

function ChartCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function mergeCategoryGroups(series: Array<{ label: string; entries: AccountancyEntry[] }>) {
  const rows = new Map<string, ChartRow>();

  series.forEach(({ label, entries }) => {
    groupAccountancyEntriesByCategory(entries).forEach(group => {
      const existing = rows.get(group.category) || { category: group.category };
      existing[label] = group.total;
      rows.set(group.category, existing);
    });
  });

  return Array.from(rows.values())
    .map(row => ({
      category: String(row.category),
      ...series.reduce((acc, item) => ({ ...acc, [item.label]: Number(row[item.label] || 0) }), {}),
    }))
    .sort((left, right) => {
      const leftTotal = series.reduce((sum, item) => sum + Number(left[item.label] || 0), 0);
      const rightTotal = series.reduce((sum, item) => sum + Number(right[item.label] || 0), 0);
      return rightTotal - leftTotal;
    });
}

function buildMonthlyRows(entries: AccountancyEntry[]) {
  const rows = entries.reduce((acc, entry) => {
    const month = entry.date?.slice(0, 7) || "Unknown";
    const existing = acc.get(month) || {
      month,
      Revenue: 0,
      Expenses: 0,
      Assets: 0,
      Liabilities: 0,
    };

    if (entry.type === "Revenue") existing.Revenue += entry.amount;
    if (entry.type === "Expense") existing.Expenses += entry.amount;
    if (entry.type === "Asset") existing.Assets += entry.amount;
    if (entry.type === "Liability") existing.Liabilities += entry.amount;

    acc.set(month, existing);
    return acc;
  }, new Map<string, { month: string; Revenue: number; Expenses: number; Assets: number; Liabilities: number }>());

  return Array.from(rows.values()).sort((left, right) => left.month.localeCompare(right.month));
}

function compactMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}
