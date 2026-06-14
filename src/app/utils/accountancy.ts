import type { AccountancyEntry } from "../context/AppContext";

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

export function formatMoney(value: number, currency = "USD") {
  const normalizedCurrency = normalizeCurrency(currency);
  if (normalizedCurrency === "THS") {
    return `THS ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value || 0)}`;
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
  if (value === "TZS") return "THS";
  return value === "THS" ? "THS" : "USD";
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

  if (currency === "THS") {
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
}) {
  return params.accountancyEntries
    .filter(entry => entry.propertyId === params.propertyId && entry.status === "Confirmed")
    .map(normalizeAccountancyEntry);
}

export function getAccountancySummary(params: {
  propertyId: string;
  accountancyEntries: AccountancyEntry[];
}): AccountancySummary {
  const confirmedEntries = getConfirmedAccountancyEntries(params);

  const ledgerRevenue = sumByType(confirmedEntries, "Revenue");
  const ledgerExpenses = sumByType(confirmedEntries, "Expense");
  const totalAssets = sumByType(confirmedEntries, "Asset");
  const totalLiabilities = sumByType(confirmedEntries, "Liability");

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

export function groupAccountancyEntriesByCategory(entries: AccountancyEntry[]) {
  const groups = entries.map(normalizeAccountancyEntry).reduce((acc, entry) => {
    const key = entry.category || "Uncategorized";
    if (!acc[key]) {
      acc[key] = {
        category: key,
        total: 0,
        entries: [],
        subcategories: {},
      };
    }

    acc[key].total += getEntryUsdAmount(entry);
    acc[key].entries.push(entry);

    const breakdown = entry.subcategoryBreakdown?.length
      ? entry.subcategoryBreakdown
      : [{ name: "Unassigned", amount: entry.amount, amountUsd: getEntryUsdAmount(entry), amountThs: getEntryThsAmount(entry) }];

    breakdown.forEach(subcategory => {
      const name = subcategory.name || "Unassigned";
      acc[key].subcategories[name] = (acc[key].subcategories[name] || 0) + Number(subcategory.amountUsd || 0);
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

export function roundMoney(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
}

function sumByType(entries: AccountancyEntry[], type: AccountancyEntry["type"]) {
  return entries
    .filter(entry => entry.type === type)
    .reduce((sum, entry) => sum + getEntryUsdAmount(entry), 0);
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
