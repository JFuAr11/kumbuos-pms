import { Download, Wallet } from "lucide-react";
import { AccountancyLedgerManager } from "../../components/accountancy/AccountancyLedgerManager";
import { Button } from "../../components/ui/button";
import { useAppContext } from "../../context/AppContext";
import { exportToCSV, exportToExcel, exportToJSON } from "../../utils/export";
import { formatMoney, getAccountancySummary, groupAccountancyEntriesByCategory } from "../../utils/accountancy";

export function AccountancyAssets() {
  const { accountancyEntries, selectedPropertyId } = useAppContext();
  const summary = getAccountancySummary({ propertyId: selectedPropertyId, accountancyEntries });
  const assetEntries = accountancyEntries.filter(entry => entry.propertyId === selectedPropertyId && entry.type === "Asset" && entry.status === "Confirmed");
  const assetGroups = groupAccountancyEntriesByCategory(assetEntries);

  const rows = assetEntries.map(entry => ({
    Date: entry.date,
    Category: entry.category,
    Subcategories: entry.subcategories?.join(", ") || "",
    Counterparty: entry.counterparty,
    Reference: entry.reference || "",
    Amount: entry.amount,
    Source: entry.source,
    Details: entry.description,
  }));

  const handleExport = (type: "csv" | "excel" | "json") => {
    if (type === "csv") exportToCSV(rows, "Assets");
    if (type === "excel") exportToExcel(rows, "Assets");
    if (type === "json") exportToJSON(rows, "Assets");
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Assets</h1>
          <p className="text-muted-foreground">Confirmed asset lines for the active property. These feed the Balance Sheet.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")}><Download className="mr-2 h-4 w-4" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("excel")}>Excel</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("json")}>JSON</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label="Total Assets" value={formatMoney(summary.totalAssets)} />
        <SummaryCard label="Confirmed Entries" value={String(assetEntries.length)} />
        <SummaryCard label="Asset Categories" value={String(assetGroups.length)} />
      </div>

      <CategoryPanel items={assetGroups} />

      <AccountancyLedgerManager title="Manage Asset Ledger Entries" filter="Asset" />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <Wallet className="h-4 w-4 text-green-600" />
      </div>
      <p className="mt-2 text-2xl font-bold text-green-600">{value}</p>
    </div>
  );
}

function CategoryPanel({ items }: { items: ReturnType<typeof groupAccountancyEntriesByCategory> }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="font-semibold">Assets by Category</h2>
      <div className="mt-4 space-y-2">
        {items.map(group => (
          <div key={group.category} className="rounded-md bg-muted/40 px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{group.category}</span>
              <span className="font-semibold text-green-600">{formatMoney(group.total)}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.keys(group.subcategories).map(subcategory => (
                <span key={subcategory} className="rounded-full bg-background px-2 py-1 text-xs text-muted-foreground">{subcategory}</span>
              ))}
            </div>
          </div>
        ))}
        {!items.length && <p className="text-sm text-muted-foreground">No confirmed asset entries yet.</p>}
      </div>
    </div>
  );
}
