import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { BookingPayment, Client, useAppContext } from "../context/AppContext";

export function BookingPayments() {
  const {
    reservations,
    clients,
    rooms,
    bookingPayments,
    addBookingPayment,
    selectedPropertyId,
  } = useAppContext();

  const [filters, setFilters] = useState({ id: "", client: "", category: "", checkIn: "", checkOut: "" });
  const [selectedReservationId, setSelectedReservationId] = useState("");
  const [paymentForm, setPaymentForm] = useState<Partial<BookingPayment>>({ date: new Date().toISOString().split("T")[0], method: "Bank Transfer" });

  const propertyReservations = reservations.filter(reservation => reservation.propertyId === selectedPropertyId);
  const filtered = useMemo(() => propertyReservations.filter(reservation => {
    const client = clients.find(item => item.id === reservation.clientId);
    if (filters.id && !reservation.id.toLowerCase().includes(filters.id.toLowerCase())) return false;
    if (filters.client && !client?.name.toLowerCase().includes(filters.client.toLowerCase())) return false;
    if (filters.category && client?.category !== filters.category) return false;
    if (filters.checkIn && reservation.checkIn < filters.checkIn) return false;
    if (filters.checkOut && reservation.checkOut > filters.checkOut) return false;
    return true;
  }), [propertyReservations, clients, filters]);

  const selectedReservation = reservations.find(item => item.id === selectedReservationId);
  const selectedPaid = bookingPayments.filter(item => item.reservationId === selectedReservationId).reduce((sum, item) => sum + item.amount, 0);

  const savePayment = () => {
    if (!selectedReservation || !paymentForm.amount || !paymentForm.date) return;
    addBookingPayment({
      id: `pay-${Date.now()}`,
      reservationId: selectedReservation.id,
      propertyId: selectedReservation.propertyId,
      date: paymentForm.date,
      amount: Number(paymentForm.amount),
      method: paymentForm.method || "Bank Transfer",
      reference: paymentForm.reference || "",
      notes: paymentForm.notes || "",
    });
    setPaymentForm({ date: new Date().toISOString().split("T")[0], method: "Bank Transfer" });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Booking Payments</h1>
        <p className="text-muted-foreground">Track partial and full payments. Partial payments confirm reservations; full payments mark them as fully paid.</p>
      </div>

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium"><Search size={16} /> Filters</div>
        <div className="grid gap-3 md:grid-cols-5">
          <Field label="Reservation ID" value={filters.id} onChange={value => setFilters({ ...filters, id: value })} />
          <Field label="Client Name" value={filters.client} onChange={value => setFilters({ ...filters, client: value })} />
          <Select label="Client Type" value={filters.category} onChange={value => setFilters({ ...filters, category: value })} options={["", "Tour Operator", "Agency", "Direct Client", "Corporate", "Other"]} />
          <Field label="Check-in From" type="date" value={filters.checkIn} onChange={value => setFilters({ ...filters, checkIn: value })} />
          <Field label="Check-out To" type="date" value={filters.checkOut} onChange={value => setFilters({ ...filters, checkOut: value })} />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Reservation</th>
                <th className="p-3">Client</th>
                <th className="p-3">Dates</th>
                <th className="p-3">Room</th>
                <th className="p-3">Total / Paid</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(reservation => {
                const client = clients.find(item => item.id === reservation.clientId);
                const room = rooms.find(item => item.id === reservation.roomId);
                const paid = bookingPayments.filter(item => item.reservationId === reservation.id).reduce((sum, item) => sum + item.amount, 0);
                return (
                  <tr key={reservation.id} className={`cursor-pointer border-t border-border hover:bg-muted/30 ${selectedReservationId === reservation.id ? "bg-primary/10" : ""}`} onClick={() => setSelectedReservationId(reservation.id)}>
                    <td className="p-3 font-medium">{reservation.id}</td>
                    <td className="p-3">{client?.name}<div className="text-xs text-muted-foreground">{client?.category}</div></td>
                    <td className="p-3">{reservation.checkIn} to {reservation.checkOut}</td>
                    <td className="p-3">{room?.name}</td>
                    <td className="p-3">${reservation.price} / ${paid}</td>
                    <td className="p-3">{reservation.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <aside className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 font-semibold">Add Payment</h2>
          {selectedReservation ? (
            <div className="space-y-3">
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="font-medium">{selectedReservation.id}</p>
                <p className="text-muted-foreground">Total ${selectedReservation.price} - Paid ${selectedPaid} - Balance ${Math.max(0, selectedReservation.price - selectedPaid)}</p>
              </div>
              <Field label="Date" type="date" value={paymentForm.date} onChange={value => setPaymentForm({ ...paymentForm, date: value })} />
              <Field label="Amount" type="number" value={paymentForm.amount?.toString()} onChange={value => setPaymentForm({ ...paymentForm, amount: Number(value) })} />
              <Select label="Method" value={paymentForm.method || "Bank Transfer"} onChange={value => setPaymentForm({ ...paymentForm, method: value as BookingPayment["method"] })} options={["Bank Transfer", "Card", "Cash", "Mobile Money", "Other"]} />
              <Field label="Reference" value={paymentForm.reference} onChange={value => setPaymentForm({ ...paymentForm, reference: value })} />
              <Field label="Notes" value={paymentForm.notes} onChange={value => setPaymentForm({ ...paymentForm, notes: value })} />
              <Button className="w-full" onClick={savePayment}>Save Payment</Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a reservation to add a partial or full payment.</p>
          )}
        </aside>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value?: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block text-sm font-medium">{label}<Input className="mt-1" type={type} value={value || ""} onChange={event => onChange(event.target.value)} /></label>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="block text-sm font-medium">{label}
      <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={value} onChange={event => onChange(event.target.value)}>
        {options.map(option => <option key={option} value={option}>{option || "All"}</option>)}
      </select>
    </label>
  );
}
