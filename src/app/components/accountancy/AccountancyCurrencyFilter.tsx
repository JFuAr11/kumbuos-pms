import type { AccountancyDisplayCurrency } from "../../context/AppContext";
import { useAppContext } from "../../context/AppContext";

export function AccountancyCurrencyFilter({ compact = false }: { compact?: boolean }) {
  const { accountancyDisplayCurrency, setAccountancyDisplayCurrency } = useAppContext();

  const options: AccountancyDisplayCurrency[] = ["USD", "THS"];

  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 p-2 shadow-sm ${compact ? "" : "sm:justify-end"}`}>
      <span className="px-2 text-xs font-semibold uppercase tracking-wider text-primary">View figures in</span>
      <div className="grid grid-cols-2 rounded-md bg-background/70 p-1">
        {options.map(option => (
          <button
            key={option}
            type="button"
            className={`rounded px-3 py-1.5 text-sm font-semibold transition-colors ${
              accountancyDisplayCurrency === option
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            onClick={() => setAccountancyDisplayCurrency(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
