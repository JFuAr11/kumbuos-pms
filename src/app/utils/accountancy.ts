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

export type AccountancySyncDiagnostic = {
  ok: boolean;
  status: "synced" | "attention";
  message: string;
  pAndLSourceCount: number;
  balanceSourceCount: number;
  confirmedCount: number;
  draftCount: number;
  orphanCount: number;
  overviewSource: {
    netProfit: number;
    netBalance: number;
  };
  checks: Array<{
    label: string;
    status: "ok" | "attention";
    detail: string;
  }>;
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

export function getAccountancySyncDiagnostic(params: {
  propertyId: string;
  accountancyEntries: AccountancyEntry[];
  displayCurrency?: AccountancyDisplayCurrency;
  dateRange?: AccountancyDateRange;
}): AccountancySyncDiagnostic {
  const displayCurrency = params.displayCurrency || "USD";
  const propertyEntries = params.accountancyEntries.filter(entry => entry.propertyId === params.propertyId);
  const inRangeEntries = filterEntriesByDateRange(propertyEntries, params.dateRange);
  const confirmedEntries = inRangeEntries.filter(entry => entry.status === "Confirmed").map(normalizeAccountancyEntry);
  const draftEntries = inRangeEntries.filter(entry => entry.status !== "Confirmed");
  const pAndLSourceEntries = confirmedEntries.filter(entry => entry.type === "Revenue" || entry.type === "Expense");
  const balanceSourceEntries = confirmedEntries.filter(entry => entry.type === "Asset" || entry.type === "Liability");
  const orphanEntries = confirmedEntries.filter(entry => !["Revenue", "Expense", "Asset", "Liability"].includes(entry.type));
  const summary = getAccountancySummary(params);
  const calculatedProfit = sumByType(confirmedEntries, "Revenue", displayCurrency) - sumByType(confirmedEntries, "Expense", displayCurrency);
  const calculatedBalance = sumByType(confirmedEntries, "Asset", displayCurrency) - sumByType(confirmedEntries, "Liability", displayCurrency);
  const amountTolerance = displayCurrency === "TZS" ? 1 : 0.01;
  const pAndLMatches = Math.abs(calculatedProfit - summary.netProfit) <= amountTolerance;
  const balanceMatches = Math.abs(calculatedBalance - summary.netBalance) <= amountTolerance;
  const checks = [
    {
      label: "Profit & Loss source",
      status: pAndLMatches ? "ok" as const : "attention" as const,
      detail: `${pAndLSourceEntries.length} confirmed Revenue/Expense entries feed P&L.`,
    },
    {
      label: "Balance source",
      status: balanceMatches ? "ok" as const : "attention" as const,
      detail: `${balanceSourceEntries.length} confirmed Asset/Liability entries feed Balance.`,
    },
    {
      label: "Overview source",
      status: pAndLMatches && balanceMatches ? "ok" as const : "attention" as const,
      detail: "Overview is derived from P&L net result and Balance net position.",
    },
    {
      label: "Draft entries",
      status: draftEntries.length ? "attention" as const : "ok" as const,
      detail: draftEntries.length
        ? `${draftEntries.length} draft entries are excluded from statements until confirmed.`
        : "No draft entries are affecting statement visibility.",
    },
    {
      label: "Ledger classification",
      status: orphanEntries.length ? "attention" as const : "ok" as const,
      detail: orphanEntries.length
        ? `${orphanEntries.length} confirmed entries have an unsupported type.`
        : "Every confirmed entry maps to P&L or Balance.",
    },
  ];
  const ok = checks.every(check => check.status === "ok");

  return {
    ok,
    status: ok ? "synced" : "attention",
    message: ok
      ? "Accountancy is synchronized: P&L, Balance, and Overview are recalculated from confirmed ledger entries."
      : "Accountancy needs attention: review draft or unsupported entries before relying on statements.",
    pAndLSourceCount: pAndLSourceEntries.length,
    balanceSourceCount: balanceSourceEntries.length,
    confirmedCount: confirmedEntries.length,
    draftCount: draftEntries.length,
    orphanCount: orphanEntries.length,
    overviewSource: {
      netProfit: summary.netProfit,
      netBalance: summary.netBalance,
    },
    checks,
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
      : [{ name: "Unassigned", amount: entry.amount, amountUsd: getEntryUsdAmount(entry), amountThs: getEntryThsAmount(entry), lineTotal: entry.amount }];

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
        const quantity = Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : undefined;
        const unitPrice = Number.isFinite(Number(item.unitPrice)) ? Number(item.unitPrice) : undefined;
        const computedLineTotal = quantity && unitPrice ? roundMoney(quantity * unitPrice, normalizeCurrency(currency) === "TZS" ? 0 : 2) : undefined;
        const lineTotal = Number.isFinite(Number(item.lineTotal)) ? Number(item.lineTotal) : computedLineTotal;
        const amount = Number.isFinite(Number(item.amount)) ? Number(item.amount) : Number(lineTotal || 0);
        const fx = buildDualCurrencyAmounts({ amount, currency, fxUsdThs, fxThsUsd });
        const unitFx = unitPrice !== undefined
          ? buildDualCurrencyAmounts({ amount: unitPrice, currency, fxUsdThs, fxThsUsd })
          : null;
        const lineFx = Number.isFinite(Number(lineTotal))
          ? buildDualCurrencyAmounts({ amount: Number(lineTotal), currency, fxUsdThs, fxThsUsd })
          : fx;
        return {
          name: item.name.trim(),
          amount,
          amountUsd: Number(item.amountUsd || fx.amountUsd),
          amountThs: Number(item.amountThs || fx.amountThs),
          quantity,
          unit: item.unit || "",
          unitPrice,
          lineTotal: Number.isFinite(Number(item.lineTotal)) ? Number(item.lineTotal) : amount,
          unitPriceUsd: Number.isFinite(Number(item.unitPriceUsd)) ? Number(item.unitPriceUsd) : unitFx?.amountUsd,
          unitPriceThs: Number.isFinite(Number(item.unitPriceThs)) ? Number(item.unitPriceThs) : unitFx?.amountThs,
          lineTotalUsd: Number.isFinite(Number(item.lineTotalUsd)) ? Number(item.lineTotalUsd) : lineFx.amountUsd,
          lineTotalThs: Number.isFinite(Number(item.lineTotalThs)) ? Number(item.lineTotalThs) : lineFx.amountThs,
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
      lineTotal: splitAmount,
      lineTotalUsd: fx.amountUsd,
      lineTotalThs: fx.amountThs,
    };
  });
}

export function formatAccountancyLineItem(
  item: NonNullable<AccountancyEntry["subcategoryBreakdown"]>[number],
  currency = "USD",
) {
  const parts = [item.name || "Unassigned"];
  const quantity = Number(item.quantity || 0);
  const unitPrice = Number(item.unitPrice || 0);
  const lineTotal = Number(item.lineTotal ?? item.amount ?? 0);

  if (quantity || unitPrice) {
    parts.push(`qty ${quantity || "-"}${item.unit ? ` ${item.unit}` : ""}`);
    parts.push(`unit ${formatMoney(unitPrice, currency)}`);
    parts.push(`line ${formatMoney(lineTotal, currency)}`);
  } else {
    parts.push(formatMoney(Number(item.amount || 0), currency));
  }

  return parts.join(" | ");
}
