import type { AccountancyEntry } from "../context/AppContext";

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
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function getConfirmedAccountancyEntries(params: {
  propertyId: string;
  accountancyEntries: AccountancyEntry[];
}) {
  return params.accountancyEntries.filter(
    entry => entry.propertyId === params.propertyId && entry.status === "Confirmed",
  );
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
  const groups = entries.reduce((acc, entry) => {
    const key = entry.category || "Uncategorized";
    if (!acc[key]) {
      acc[key] = {
        category: key,
        total: 0,
        entries: [],
        subcategories: {},
      };
    }

    acc[key].total += entry.amount;
    acc[key].entries.push(entry);

    const subcategories = normalizeSubcategories(entry.subcategories);
    const splitAmount = entry.amount / subcategories.length;
    subcategories.forEach(subcategory => {
      acc[key].subcategories[subcategory] = (acc[key].subcategories[subcategory] || 0) + splitAmount;
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

function sumByType(entries: AccountancyEntry[], type: AccountancyEntry["type"]) {
  return entries
    .filter(entry => entry.type === type)
    .reduce((sum, entry) => sum + entry.amount, 0);
}

function normalizeSubcategories(subcategories?: string[]) {
  const cleaned = (subcategories || [])
    .map(item => item.trim())
    .filter(Boolean);

  return cleaned.length ? cleaned : ["Unassigned"];
}
