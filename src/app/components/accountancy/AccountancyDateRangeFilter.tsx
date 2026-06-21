import type { AccountancyDateRange } from "../../utils/accountancy";
import { getDefaultAccountancyDateRange } from "../../utils/accountancy";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function AccountancyDateRangeFilter({
  value,
  onChange,
  compact = false,
}: {
  value: AccountancyDateRange;
  onChange: (value: AccountancyDateRange) => void;
  compact?: boolean;
}) {
  const reset = () => onChange(getDefaultAccountancyDateRange());
  const hasCustomRange = Boolean(value.from) || value.to !== getDefaultAccountancyDateRange().to;

  return (
    <div className={`rounded-lg border border-border bg-card/80 p-3 shadow-sm ${compact ? "w-full sm:w-auto" : ""}`}>
      <div className={`grid gap-3 ${compact ? "sm:grid-cols-[minmax(0,150px)_minmax(0,150px)_auto]" : "sm:grid-cols-[minmax(0,180px)_minmax(0,180px)_auto]"}`}>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          From
          <Input
            className="mt-1 h-9"
            type="date"
            value={value.from || ""}
            onChange={event => onChange({ ...value, from: event.target.value })}
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          To
          <Input
            className="mt-1 h-9"
            type="date"
            value={value.to || ""}
            onChange={event => onChange({ ...value, to: event.target.value })}
          />
        </label>
        <div className="flex items-end">
          <Button className="h-9 w-full sm:w-auto" type="button" variant="outline" size="sm" onClick={reset}>
            All history
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {hasCustomRange
          ? "Showing confirmed entries inside the selected date interval."
          : `Default: full history through today (${value.to || getDefaultAccountancyDateRange().to}).`}
      </p>
    </div>
  );
}
