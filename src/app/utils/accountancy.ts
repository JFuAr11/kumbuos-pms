import type { AccountancyDisplayCurrency, AccountancyEntry } from "../context/AppContext";

export const DEFAULT_FX_USD_THS = 2600;
export const DEFAULT_FX_THS_USD = 1 / DEFAULT_FX_USD_THS;

export type AccountancySummary = {
  ledgerRevenue: number;
  ledgerExpenses: number;
  totalAssets: number;
  totalLiabilities: number;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  netBalance: number;
};

export type CategoryGroup = {
  category: string;
  total: number;
  entries: AccountancyEntry[];
  subcategories: Record<string, number>;
};

export type AccountancyDateRange = {
  from?: string;
  to?: string;
};

export type { AccountancyDisplayCurrency };

export function getTodayIsoDate() {
  return new Date().toISOString().split("T")[0];
}

export function getDefaultAccountancyDateRange(): AccountancyDateRange {
  return {
    from: "",
    to: getTodayIsoDate(),
  };
}

export function isEntryInDateRange(entry: Pick<AccountancyEntry, "date">, dateRange?: AccountancyDateRange) {
  if (!dateRange) return true;
  const date = entry.date || "";
  if (!date) return false;
  if (dateRange.from && date < dateRange.from) return false;
  if (dateRange.to && date > dateRange.to) return false;
  return true;
}

export function filterEntriesByDateRange<T extends Pick<AccountancyEntry, "date">>(entries: T[], dateRange?: AccountancyDateRange) {
  return entries.filter(entry => isEntryInDateRange(entry, dateRange));
}

export function formatMoney(value: number, currency = "USD") {
  const normalizedCurrency = normalizeCurrency(currency);
  if (normalizedCurrency === "TZS") {
    return `TZS ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value || 0)}`;
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(value || 0);
  } catch {
    return `${normalizedCurrency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value || 0)}`;
  }
}

export function normalizeCurrency(currency?: string) {
  const value = (currency || "USD").trim().toUpperCase();
  if (value === "TZS" || value === "THS") return "TZS";
  return "USD";
}

export function getFxForDate(_date?: string) {
  return {
    fxUsdThs: DEFAULT_FX_USD_THS,
    fxThsUsd: DEFAULT_FX_THS_USD,
  };
}

export function buildDualCurrencyAmounts(params: {
  amount: number;
  currency?: string;
  fxUsdThs?: number;
  fxThsUsd?: number;
}) {
  const currency = normalizeCurrency(params.currency);
  const fxUsdThs = Number(params.fxUsdThs || DEFAULT_FX_USD_THS);
  const fxThsUsd = Number(params.fxThsUsd || (fxUsdThs ? 1 / fxUsdThs : DEFAULT_FX_THS_USD));
  const amount = Number(params.amount || 0);

  if (currency === "TZS") {
    return {
      amountUsd: roundMoney(amount * fxThsUsd),
      amountThs: roundMoney(amount, 0),
      fxUsdThs,
      fxThsUsd,
    };
  }

  return {
    amountUsd: roundMoney(amount),
    amountThs: roundMoney(amount * fxUsdThs, 0),
    fxUsdThs,
    fxThsUsd,
  };
}

export function normalizeAccountancyEntry(entry: AccountancyEntry): AccountancyEntry {
  const fx = buildDualCurrencyAmounts({
    amount: entry.amount,
    currency: entry.currency,
    fxUsdThs: entry.fxUsdThs,
    fxThsUsd: entry.fxThsUsd,
  });
  const currency = normalizeCurrency(entry.currency);

  return {
    ...entry,
    currency,
    amountUsd: entry.amountUsd ?? fx.amountUsd,
    amountThs: entry.amountThs ?? fx.amountThs,
    fxUsdThs: entry.fxUsdThs ?? fx.fxUsdThs,
    fxThsUsd: entry.fxThsUsd ?? fx.fxThsUsd,
    subcategoryBreakdown: normalizeSubcategoryBreakdown(entry, fx.fxUsdThs, fx.fxThsUsd, currency),
  };
}

export function getConfirmedAccountancyEntries(params: {
  propertyId: string;
  accountancyEntries: AccountancyEntry[];
  dateRange?: AccountancyDateRange;
}) {
  return params.accountancyEntries
    .filter(entry => entry.propertyId === params.propertyId && entry.status === "Confirmed")
    .filter(entry => isEntryInDateRange(entry, params.dateRange))
    .map(normalizeAccountancyEntry);
}

export function getAccountancySummary(params: {
  propertyId: string;
  accountancyEntries: AccountancyEntry[];
  displayCurrency?: AccountancyDisplayCurrency;
  dateRange?: AccountancyDateRange;
}): AccountancySummary {
  const confirmedEntries = getConfirmedAccountancyEntries(params);
  const displayCurrency = params.displayCurrency || "USD";

  const ledgerRevenue = sumByType(confirmedEntries, "Revenue", displayCurrency);
  const ledgerExpenses = sumByType(confirmedEntries, "Expense", displayCurrency);
  const totalAssets = sumByType(confirmedEntries, "Asset", displayCurrency);
  const totalLiabilities = sumByType(confirmedEntries, "Liability", displayCurrency);

  return {
    ledgerRevenue,
    ledgerExpenses,
    totalAssets,
    totalLiabilities,
    totalRevenue: ledgerRevenue,
    totalExpenses: ledgerExpenses,
    netProfit: ledgerRevenue - ledgerExpenses,
    netBalance: totalAssets - totalLiabilities,
  };
}

export function groupAccountancyEntriesByCategory(entries: AccountancyEntry[], displayCurrency: AccountancyDisplayCurrency = "USD") {
  const groups = entries.map(normalizeAccountancyEntry).reduce((acc, entry) => {
    const key = getDatedCategoryName(entry.category || "Uncategorized", entry.date);
    if (!acc[key]) {
      acc[key] = {
        category: key,
        total: 0,
        entries: [],
        subcategories: {},
      };
    }

    acc[key].total += getEntryDisplayAmount(entry, displayCurrency);
    acc[key].entries.push(entry);

    const breakdown = entry.subcategoryBreakdown?.length
      ? entry.subcategoryBreakdown
      : [{ name: "Unassigned", amount: entry.amount, amountUsd: getEntryUsdAmount(entry), amountThs: getEntryThsAmount(entry) }];

    breakdown.forEach(subcategory => {
      const name = subcategory.name || "Unassigned";
      const amount = displayCurrency === "TZS" ? Number(subcategory.amountThs || 0) : Number(subcategory.amountUsd || 0);
      acc[key].subcategories[name] = (acc[key].subcategories[name] || 0) + amount;
    });

    return acc;
  }, {} as Record<string, CategoryGroup>);

  return Object.values(groups).sort((left, right) => right.total - left.total);
}

export function flattenCategoryGroups(groups: CategoryGroup[], section: string, sign = 1) {
  return groups.flatMap(group => [
    { Section: section, Category: group.category, Subcategory: "", Amount: group.total * sign },
    ...Object.entries(group.subcategories).map(([subcategory, amount]) => ({
      Section: section,
      Category: group.category,
      Subcategory: subcategory,
      Amount: amount * sign,
    })),
  ]);
}

export function getEntryUsdAmount(entry: AccountancyEntry) {
  return Number(entry.amountUsd ?? buildDualCurrencyAmounts(entry).amountUsd ?? 0);
}

export function getEntryThsAmount(entry: AccountancyEntry) {
  return Number(entry.amountThs ?? buildDualCurrencyAmounts(entry).amountThs ?? 0);
}

export function getEntryDisplayAmount(entry: AccountancyEntry, displayCurrency: AccountancyDisplayCurrency = "USD") {
  return displayCurrency === "TZS" ? getEntryThsAmount(entry) : getEntryUsdAmount(entry);
}

export function formatDisplayMoney(value: number, displayCurrency: AccountancyDisplayCurrency = "USD") {
  return formatMoney(value, displayCurrency);
}

export function getDatedCategoryName(category: string, date?: string) {
  const cleanCategory = (category || "Uncategorized").trim();
  if (!date) return cleanCategory;
  const isoDate = date.slice(0, 10);
  if (!isoDate) return cleanCategory;
  const withoutExistingDate = cleanCategory.replace(/\s+\d{4}-\d{2}-\d{2}$/u, "").trim();
  return `${withoutExistingDate} ${isoDate}`;
}

export function roundMoney(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
}

function sumByType(entries: AccountancyEntry[], type: AccountancyEntry["type"], displayCurrency: AccountancyDisplayCurrency) {
  return entries
    .filter(entry => entry.type === type)
    .reduce((sum, entry) => sum + getEntryDisplayAmount(entry, displayCurrency), 0);
}

function normalizeSubcategoryBreakdown(
  entry: AccountancyEntry,
  fxUsdThs: number,
  fxThsUsd: number,
  currency: string,
) {
  if (entry.subcategoryBreakdown?.length) {
    return entry.subcategoryBreakdown
      .map(item => {
        const amount = Number(item.amount || 0);
        const fx = buildDualCurrencyAmounts({ amount, currency, fxUsdThs, fxThsUsd });
        return {
          name: item.name.trim(),
          amount,
          amountUsd: Number(item.amountUsd || fx.amountUsd),
          amountThs: Number(item.amountThs || fx.amountThs),
        };
      })
      .filter(item => item.name);
  }

  const names = (entry.subcategories || []).map(item => item.trim()).filter(Boolean);
  if (!names.length) return [];

  const splitAmount = Number(entry.amount || 0) / names.length;
  return names.map(name => {
    const fx = buildDualCurrencyAmounts({ amount: splitAmount, currency, fxUsdThs, fxThsUsd });
    return {
      name,
      amount: splitAmount,
      amountUsd: fx.amountUsd,
      amountThs: fx.amountThs,
    };
  });
}
