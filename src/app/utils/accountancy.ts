import type { AccountancyEntry, Reservation, SupplyRequest } from "../context/AppContext";

export type AccountancySummary = {
  bookingsRevenue: number;
  ledgerRevenue: number;
  supplyExpenses: number;
  ledgerExpenses: number;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
};

export function formatMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function getAccountancySummary(params: {
  propertyId: string;
  reservations: Reservation[];
  supplyRequests: SupplyRequest[];
  accountancyEntries: AccountancyEntry[];
}): AccountancySummary {
  const propertyReservations = params.reservations.filter(
    reservation => reservation.propertyId === params.propertyId && reservation.status !== "Cancelled",
  );
  const propertySupplyRequests = params.supplyRequests.filter(request => request.propertyId === params.propertyId);
  const confirmedEntries = params.accountancyEntries.filter(
    entry => entry.propertyId === params.propertyId && entry.status === "Confirmed",
  );

  const bookingsRevenue = propertyReservations.reduce((sum, reservation) => sum + reservation.price, 0);
  const ledgerRevenue = confirmedEntries
    .filter(entry => entry.type === "Revenue")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const supplyExpenses = propertySupplyRequests.reduce((sum, request) => sum + request.amount, 0);
  const ledgerExpenses = confirmedEntries
    .filter(entry => entry.type === "Expense")
    .reduce((sum, entry) => sum + entry.amount, 0);

  const totalRevenue = bookingsRevenue + ledgerRevenue;
  const totalExpenses = supplyExpenses + ledgerExpenses;

  return {
    bookingsRevenue,
    ledgerRevenue,
    supplyExpenses,
    ledgerExpenses,
    totalRevenue,
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
  };
}

export function groupAccountancyEntriesByCategory(entries: AccountancyEntry[]) {
  return entries.reduce((acc, entry) => {
    acc[entry.category] = (acc[entry.category] || 0) + entry.amount;
    return acc;
  }, {} as Record<string, number>);
}
