import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BarChart3, CalendarDays, Download, Filter, Table2, TrendingUp, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import type { Client, Reservation } from "../context/AppContext";
import { useAppContext } from "../context/AppContext";
import { exportToCSV, exportToExcel, exportToJSON, exportToPDF } from "../utils/export";

type ReportTable = "clientRevenue" | "monthlyRevenue" | "occupancy" | "cancellations" | "ranking";
type SortState = { key: string; direction: "asc" | "desc" };
type ReportRow = Record<string, string | number>;

const clientTypes: Array<Client["category"] | "All"> = ["All", "Tour Operator", "Agency", "Direct Client", "Corporate", "Other"];
const sources: Array<Reservation["source"] | "All"> = ["All", "Direct", "Booking.com", "Expedia", "Airbnb", "Other OTA"];

export function ReservationReports() {
  const { reservations, bookingPayments, clients, rooms, selectedPropertyId } = useAppContext();
  const today = new Date().toISOString().split("T")[0];
  const [filters, setFilters] = useState({
    from: "",
    to: today,
    clientType: "All",
    clientId: "All",
    source: "All",
  });
  const [activeTable, setActiveTable] = useState<ReportTable>("clientRevenue");
  const [sort, setSort] = useState<SortState>({ key: "Total Revenue", direction: "desc" });

  const propertyRooms = rooms.filter(room => room.propertyId === selectedPropertyId);
  const propertyClients = clients;
  const propertyReservations = reservations.filter(reservation => reservation.propertyId === selectedPropertyId);

  const filteredReservations = useMemo(() => propertyReservations.filter(reservation => {
    const client = clients.find(item => item.id === reservation.clientId);
    if (filters.from && reservation.checkIn < filters.from) return false;
    if (filters.to && reservation.checkIn > filters.to) return false;
    if (filters.clientType !== "All" && client?.category !== filters.clientType) return false;
    if (filters.clientId !== "All" && reservation.clientId !== filters.clientId) return false;
    if (filters.source !== "All" && reservation.source !== filters.source) return false;
    return true;
  }), [propertyReservations, clients, filters]);

  const reports = useMemo(() => {
    const paymentsByReservation = new Map<string, number>();
    bookingPayments
      .filter(payment => payment.propertyId === selectedPropertyId)
      .forEach(payment => paymentsByReservation.set(payment.reservationId, (paymentsByReservation.get(payment.reservationId) || 0) + Number(payment.amount || 0)));

    const clientRows = new Map<string, {
      Client: string;
      "Client Type": string;
      Reservations: number;
      Cancellations: number;
      "Total Revenue": number;
      "Paid Revenue": number;
      "Average Booking Value": number;
    }>();
    const monthlyRows = new Map<string, {
      Month: string;
      "Total Revenue": number;
      "Paid Revenue": number;
      Reservations: number;
      Cancellations: number;
    }>();
    const occupancyRows = new Map<string, {
      Month: string;
      "Occupied Nights": number;
      "Available Nights": number;
      "Occupancy %": number;
      Reservations: number;
    }>();
    const cancellationsByType = new Map<string, {
      "Client Type": string;
      Reservations: number;
      Cancellations: number;
      "Cancellation %": number;
    }>();

    filteredReservations.forEach(reservation => {
      const client = clients.find(item => item.id === reservation.clientId);
      const clientName = client?.name || "Unknown client";
      const clientType = client?.category || "Direct Client";
      const paid = paymentsByReservation.get(reservation.id) || 0;
      const isCancelled = reservation.status === "Cancelled";
      const month = reservation.checkIn.slice(0, 7);

      const clientRow = clientRows.get(reservation.clientId) || {
        Client: clientName,
        "Client Type": clientType,
        Reservations: 0,
        Cancellations: 0,
        "Total Revenue": 0,
        "Paid Revenue": 0,
        "Average Booking Value": 0,
      };
      clientRow.Reservations += 1;
      clientRow.Cancellations += isCancelled ? 1 : 0;
      if (!isCancelled) {
        clientRow["Total Revenue"] += Number(reservation.price || 0);
        clientRow["Paid Revenue"] += paid;
      }
      clientRows.set(reservation.clientId, clientRow);

      const monthlyRow = monthlyRows.get(month) || {
        Month: month,
        "Total Revenue": 0,
        "Paid Revenue": 0,
        Reservations: 0,
        Cancellations: 0,
      };
      monthlyRow.Reservations += 1;
      monthlyRow.Cancellations += isCancelled ? 1 : 0;
      if (!isCancelled) {
        monthlyRow["Total Revenue"] += Number(reservation.price || 0);
        monthlyRow["Paid Revenue"] += paid;
      }
      monthlyRows.set(month, monthlyRow);

      const cancellationRow = cancellationsByType.get(clientType) || {
        "Client Type": clientType,
        Reservations: 0,
        Cancellations: 0,
        "Cancellation %": 0,
      };
      cancellationRow.Reservations += 1;
      cancellationRow.Cancellations += isCancelled ? 1 : 0;
      cancellationsByType.set(clientType, cancellationRow);

      if (!isCancelled) {
        allocateReservationNights(reservation).forEach((nights, nightMonth) => {
          const row = occupancyRows.get(nightMonth) || {
            Month: nightMonth,
            "Occupied Nights": 0,
            "Available Nights": propertyRooms.length * daysInMonth(nightMonth),
            "Occupancy %": 0,
            Reservations: 0,
          };
          row["Occupied Nights"] += nights;
          row.Reservations += 1;
          occupancyRows.set(nightMonth, row);
        });
      }
    });

    const clientRevenue = Array.from(clientRows.values()).map(row => ({
      ...row,
      "Average Booking Value": row.Reservations - row.Cancellations > 0
        ? round(row["Total Revenue"] / (row.Reservations - row.Cancellations))
        : 0,
    })).sort((left, right) => right["Total Revenue"] - left["Total Revenue"]);

    const rawMonthlyRevenue = Array.from(monthlyRows.values()).sort((left, right) => left.Month.localeCompare(right.Month));
    const monthlyRevenue = rawMonthlyRevenue.map(row => {
      const previous = monthlyRows.get(previousYearMonth(row.Month));
      const previousRevenue = previous?.["Total Revenue"] || 0;
      return {
        ...row,
        "Previous Year Total Revenue": previousRevenue,
        "YoY Revenue %": previousRevenue ? round(((row["Total Revenue"] - previousRevenue) / previousRevenue) * 100, 1) : 0,
      };
    });
    const rawOccupancy = Array.from(occupancyRows.values())
      .map(row => ({
        ...row,
        "Occupancy %": row["Available Nights"] ? round((row["Occupied Nights"] / row["Available Nights"]) * 100, 1) : 0,
      }))
      .sort((left, right) => left.Month.localeCompare(right.Month));
    const occupancyByMonth = new Map(rawOccupancy.map(row => [row.Month, row]));
    const occupancy = rawOccupancy.map(row => {
      const previous = occupancyByMonth.get(previousYearMonth(row.Month));
      const previousOccupancy = previous?.["Occupancy %"] || 0;
      return {
        ...row,
        "Previous Year Occupancy %": previousOccupancy,
        "YoY Occupancy Δ": round(row["Occupancy %"] - previousOccupancy, 1),
      };
    });
    const cancellations = Array.from(cancellationsByType.values())
      .map(row => ({
        ...row,
        "Cancellation %": row.Reservations ? round((row.Cancellations / row.Reservations) * 100, 1) : 0,
      }))
      .sort((left, right) => right.Cancellations - left.Cancellations);
    const ranking = clientRevenue.map((row, index) => ({
      Rank: index + 1,
      Client: row.Client,
      "Client Type": row["Client Type"],
      Reservations: row.Reservations,
      "Paid Revenue": row["Paid Revenue"],
      "Total Revenue": row["Total Revenue"],
      "Average Booking Value": row["Average Booking Value"],
    }));

    return { clientRevenue, monthlyRevenue, occupancy, cancellations, ranking };
  }, [bookingPayments, clients, filteredReservations, propertyRooms.length, selectedPropertyId]);

  const activeRows = reports[activeTable];
  const sortedRows = useMemo(() => sortRows(activeRows, sort), [activeRows, sort]);
  const totals = useMemo(() => {
    const activeReservations = filteredReservations.filter(reservation => reservation.status !== "Cancelled");
    const reservationIds = new Set(activeReservations.map(reservation => reservation.id));
    const totalRevenue = activeReservations.reduce((sum, reservation) => sum + Number(reservation.price || 0), 0);
    const paidRevenue = bookingPayments
      .filter(payment => payment.propertyId === selectedPropertyId && reservationIds.has(payment.reservationId))
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const cancellations = filteredReservations.filter(reservation => reservation.status === "Cancelled").length;
    const occupiedNights = reports.occupancy.reduce((sum, row) => sum + Number(row["Occupied Nights"] || 0), 0);
    const availableNights = reports.occupancy.reduce((sum, row) => sum + Number(row["Available Nights"] || 0), 0);

    return {
      totalRevenue,
      paidRevenue,
      reservations: filteredReservations.length,
      cancellations,
      occupancy: availableNights ? round((occupiedNights / availableNights) * 100, 1) : 0,
    };
  }, [bookingPayments, filteredReservations, reports.occupancy, selectedPropertyId]);

  const exportRows = (format: "csv" | "excel" | "json" | "pdf") => {
    const filename = `Reservation-Reports-${activeTable}`;
    if (format === "csv") exportToCSV(sortedRows, filename);
    if (format === "excel") exportToExcel(sortedRows, filename);
    if (format === "json") exportToJSON(sortedRows, filename);
    if (format === "pdf") exportToPDF(sortedRows, filename, "Reservations Reports");
  };

  const setSortKey = (key: string) => {
    setSort(current => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8" data-pdf-export-root>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Reservations Intelligence</p>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Live booking, revenue, occupancy, cancellation, and client ranking insights for the active property.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => exportRows("csv")}><Download className="mr-2 h-4 w-4" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => exportRows("excel")}>Excel</Button>
          <Button variant="outline" size="sm" onClick={() => exportRows("json")}>JSON</Button>
          <Button variant="outline" size="sm" onClick={() => exportRows("pdf")}>PDF</Button>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Filter className="h-4 w-4 text-primary" />
          Report filters
        </div>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Field label="From" type="date" value={filters.from} onChange={value => setFilters({ ...filters, from: value })} />
          <Field label="To" type="date" value={filters.to} onChange={value => setFilters({ ...filters, to: value })} />
          <Select label="Client Type" value={filters.clientType} onChange={value => setFilters({ ...filters, clientType: value })} options={clientTypes.map(item => String(item))} />
          <Select label="Client" value={filters.clientId} onChange={value => setFilters({ ...filters, clientId: value })} options={["All", ...propertyClients.map(client => client.id)]} labels={{ All: "All clients", ...Object.fromEntries(propertyClients.map(client => [client.id, client.name])) }} />
          <Select label="Source" value={filters.source} onChange={value => setFilters({ ...filters, source: value })} options={sources.map(item => String(item))} />
          <div className="flex items-end">
            <Button className="h-10 w-full" variant="outline" onClick={() => setFilters({ from: "", to: today, clientType: "All", clientId: "All", source: "All" })}>
              Full history
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric title="Total Revenue" value={formatUsd(totals.totalRevenue)} icon={TrendingUp} tone="positive" />
        <Metric title="Paid Revenue" value={formatUsd(totals.paidRevenue)} icon={Download} tone="positive" />
        <Metric title="Reservations" value={String(totals.reservations)} icon={CalendarDays} tone="neutral" />
        <Metric title="Cancellations" value={String(totals.cancellations)} icon={Users} tone="negative" />
        <Metric title="Occupancy" value={`${totals.occupancy}%`} icon={BarChart3} tone="neutral" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Revenue by Client" description="Paid revenue versus total invoiced revenue by client.">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={reports.clientRevenue.slice(0, 12)} margin={{ top: 10, right: 10, left: 0, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="Client" angle={-20} textAnchor="end" height={80} interval={0} tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={compactMoney} width={70} />
              <Tooltip formatter={(value) => formatUsd(Number(value))} />
              <Legend />
              <Bar dataKey="Paid Revenue" fill="#2f8f5b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Total Revenue" fill="#d08a32" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Billing" description="Monthly paid and total booking revenue.">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={reports.monthlyRevenue} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="Month" />
              <YAxis tickFormatter={compactMoney} width={70} />
              <Tooltip formatter={(value) => formatUsd(Number(value))} />
              <Legend />
              <Line type="monotone" dataKey="Paid Revenue" stroke="#2f8f5b" strokeWidth={2} />
              <Line type="monotone" dataKey="Total Revenue" stroke="#d08a32" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Occupancy" description="Occupied room nights versus monthly room-night capacity.">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={reports.occupancy} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="Month" />
              <YAxis yAxisId="left" tickFormatter={compactNumber} width={70} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${value}%`} width={55} />
              <Tooltip formatter={(value, name) => name === "Occupancy %" ? `${value}%` : compactNumber(Number(value))} />
              <Legend />
              <Bar yAxisId="left" dataKey="Occupied Nights" fill="#5c5144" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="Occupancy %" stroke="#d08a32" strokeWidth={2} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cancellations by Client Type" description="Cancellation volume and cancellation rate by segment.">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={reports.cancellations} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="Client Type" angle={-15} textAnchor="end" height={60} />
              <YAxis yAxisId="left" allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${value}%`} />
              <Tooltip formatter={(value, name) => name === "Cancellation %" ? `${value}%` : value} />
              <Legend />
              <Bar yAxisId="left" dataKey="Cancellations" fill="#b94a48" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="Cancellation %" stroke="#d08a32" strokeWidth={2} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div>
            <div className="flex items-center gap-2">
              <Table2 className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Report Data Table</h2>
            </div>
            <p className="text-sm text-muted-foreground">Choose the dataset behind each visualization and click any column to sort ascending or descending.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <TableButton active={activeTable === "clientRevenue"} onClick={() => setActiveTable("clientRevenue")}>Client revenue</TableButton>
            <TableButton active={activeTable === "monthlyRevenue"} onClick={() => setActiveTable("monthlyRevenue")}>Monthly revenue</TableButton>
            <TableButton active={activeTable === "occupancy"} onClick={() => setActiveTable("occupancy")}>Occupancy</TableButton>
            <TableButton active={activeTable === "cancellations"} onClick={() => setActiveTable("cancellations")}>Cancellations</TableButton>
            <TableButton active={activeTable === "ranking"} onClick={() => setActiveTable("ranking")}>Ranking</TableButton>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                {(Object.keys(sortedRows[0] || {}) as string[]).map(key => (
                  <th key={key} className="cursor-pointer p-4 font-medium" onClick={() => setSortKey(key)}>
                    {key} {sort.key === key ? (sort.direction === "asc" ? "↑" : "↓") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, index) => (
                <tr key={index} className="border-t border-border">
                  {Object.keys(sortedRows[0] || {}).map(key => (
                    <td key={key} className="p-4">
                      {formatCell(row[key])}
                    </td>
                  ))}
                </tr>
              ))}
              {!sortedRows.length && (
                <tr>
                  <td className="p-8 text-center text-muted-foreground">No report data for the selected filters yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({ title, value, icon: Icon, tone }: { title: string; value: string; icon: typeof TrendingUp; tone: "positive" | "negative" | "neutral" }) {
  const toneClass = tone === "positive" ? "text-green-600" : tone === "negative" ? "text-destructive" : "text-primary";
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        <Icon className={`h-5 w-5 ${toneClass}`} />
      </div>
      <p className={`mt-3 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function ChartCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <Input className="mt-1" type={type} value={value} onChange={event => onChange(event.target.value)} />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  labels = {},
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={value} onChange={event => onChange(event.target.value)}>
        {options.map(option => <option key={option} value={option}>{labels[option] || option}</option>)}
      </select>
    </label>
  );
}

function TableButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Button type="button" size="sm" variant={active ? "default" : "outline"} onClick={onClick}>
      {children}
    </Button>
  );
}

function sortRows(rows: ReportRow[], sort: SortState) {
  return [...rows].sort((left, right) => {
    const leftValue = left[sort.key];
    const rightValue = right[sort.key];
    const direction = sort.direction === "asc" ? 1 : -1;
    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return (leftValue - rightValue) * direction;
    }
    return String(leftValue ?? "").localeCompare(String(rightValue ?? "")) * direction;
  });
}

function allocateReservationNights(reservation: Reservation) {
  const rows = new Map<string, number>();
  const start = new Date(`${reservation.checkIn}T00:00:00`);
  const end = new Date(`${reservation.checkOut}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return rows;

  const cursor = new Date(start);
  while (cursor < end) {
    const month = cursor.toISOString().slice(0, 7);
    rows.set(month, (rows.get(month) || 0) + 1);
    cursor.setDate(cursor.getDate() + 1);
  }
  return rows;
}

function daysInMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(year, monthIndex, 0).getDate();
}

function previousYearMonth(month: string) {
  const [year, monthIndex] = month.split("-");
  return `${Number(year) - 1}-${monthIndex}`;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(value || 0));
}

function compactMoney(value: number) {
  const absolute = Math.abs(Number(value || 0));
  if (absolute >= 1000000) return `$${(Number(value) / 1000000).toFixed(1)}M`;
  if (absolute >= 1000) return `$${(Number(value) / 1000).toFixed(0)}K`;
  return `$${Number(value || 0).toFixed(0)}`;
}

function compactNumber(value: number) {
  const absolute = Math.abs(Number(value || 0));
  if (absolute >= 1000000) return `${(Number(value) / 1000000).toFixed(1)}M`;
  if (absolute >= 1000) return `${(Number(value) / 1000).toFixed(0)}K`;
  return String(Number(value || 0));
}

function formatCell(value: string | number) {
  if (typeof value !== "number") return value || "-";
  return Number.isInteger(value) ? value.toLocaleString("en-US") : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
