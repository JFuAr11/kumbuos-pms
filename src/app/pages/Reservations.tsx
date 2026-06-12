import { useMemo, useState } from "react";
import { Download, Edit, Search, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Reservation, useAppContext } from "../context/AppContext";
import { exportToCSV, exportToExcel, exportToJSON } from "../utils/export";

const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart);

const nightsBetween = (checkIn?: string, checkOut?: string) => {
  if (!checkIn || !checkOut) return 0;
  return Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000));
};

export function Reservations() {
  const {
    reservations,
    clients,
    rooms,
    rates,
    rateAdjustments,
    paymentPlans,
    selectedPropertyId,
    addReservation,
    updateReservation,
    deleteReservation,
    generateInvoiceHtml,
  } = useAppContext();

  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Reservation>>({ status: "Provisional", source: "Direct", residency: "Non Resident", guests: 2 });
  const [useDiscount, setUseDiscount] = useState(false);
  const [useTaxes, setUseTaxes] = useState(true);
  const [usePaymentPlan, setUsePaymentPlan] = useState(false);
  const [error, setError] = useState("");

  const propertyRooms = rooms.filter(room => room.propertyId === selectedPropertyId);
  const propertyReservations = reservations.filter(reservation => reservation.propertyId === selectedPropertyId);
  const discounts = rateAdjustments.filter(item => item.propertyId === selectedPropertyId && item.kind === "Discount" && item.active);
  const taxes = rateAdjustments.filter(item => item.propertyId === selectedPropertyId && item.kind === "Tax" && item.active);
  const propertyPaymentPlans = paymentPlans.filter(plan => plan.propertyId === selectedPropertyId && plan.active);

  const selectedClient = clients.find(client => client.id === formData.clientId);
  const selectedRoom = propertyRooms.find(room => room.id === formData.roomId);
  const availableRates = useMemo(() => rates.filter(rate => {
    if (rate.propertyId !== selectedPropertyId || rate.active === false) return false;
    if (selectedRoom?.type && rate.roomType && rate.roomType !== selectedRoom.type) return false;
    if (formData.residency && rate.residency && rate.residency !== "Both" && rate.residency !== formData.residency) return false;
    if (formData.checkIn && rate.startDate && formData.checkIn < rate.startDate) return false;
    if (formData.checkOut && rate.endDate && formData.checkOut > rate.endDate) return false;
    return true;
  }), [rates, selectedPropertyId, selectedRoom?.type, formData.residency, formData.checkIn, formData.checkOut]);

  const calculatedPrice = useMemo(() => {
    const rate = availableRates.find(item => item.id === formData.rateId);
    const nights = nightsBetween(formData.checkIn, formData.checkOut);
    const subtotal = (rate?.amount || 0) * nights;
    const discount = useDiscount ? discounts.find(item => item.id === formData.discountId) : undefined;
    const discountAmount = discount ? discount.valueType === "Percentage" ? subtotal * (discount.value / 100) : discount.value : 0;
    const taxableBase = Math.max(0, subtotal - discountAmount);
    const taxAmount = useTaxes ? (formData.taxIds || []).reduce((sum, id) => {
      const tax = taxes.find(item => item.id === id);
      if (!tax) return sum;
      if (tax.taxMode === "Included") return sum;
      return sum + (tax.valueType === "Percentage" ? taxableBase * (tax.value / 100) : tax.value);
    }, 0) : 0;
    return Number((taxableBase + taxAmount).toFixed(2));
  }, [availableRates, formData.rateId, formData.checkIn, formData.checkOut, formData.discountId, formData.taxIds, discounts, taxes, useDiscount, useTaxes]);

  const filtered = propertyReservations.filter(reservation => {
    const client = clients.find(item => item.id === reservation.clientId);
    return `${reservation.id} ${client?.name || ""}`.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleExport = (type: "csv" | "json" | "excel") => {
    const data = filtered.map(reservation => ({
      ID: reservation.id,
      Client: clients.find(client => client.id === reservation.clientId)?.name || "Unknown",
      Room: rooms.find(room => room.id === reservation.roomId)?.name || "Unknown",
      CheckIn: reservation.checkIn,
      CheckOut: reservation.checkOut,
      Price: reservation.price,
      Status: reservation.status,
    }));
    if (type === "csv") exportToCSV(data, "Reservations");
    if (type === "json") exportToJSON(data, "Reservations");
    if (type === "excel") exportToExcel(data, "Reservations");
  };

  const openInvoice = (reservationId: string) => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(generateInvoiceHtml(reservationId));
    win.document.close();
  };

  const handleClientChange = (clientId: string) => {
    const client = clients.find(item => item.id === clientId);
    const defaultPlan = client?.defaultPaymentPlanId || "";
    setFormData({ ...formData, clientId, paymentPlanId: defaultPlan });
    setUsePaymentPlan(Boolean(defaultPlan));
  };

  const handleSubmit = () => {
    setError("");
    if (!formData.clientId || !formData.roomId || !formData.checkIn || !formData.checkOut || !formData.rateId) {
      setError("Select client, room, check-in, check-out, and rate before saving.");
      return;
    }
    if (new Date(formData.checkOut) <= new Date(formData.checkIn)) {
      setError("Check-out must be after check-in.");
      return;
    }
    if (!selectedRoom) {
      setError("Select a valid room before saving.");
      return;
    }
    const guests = Number(formData.guests) || 1;
    const min = selectedRoom.minOccupancy || 1;
    const max = selectedRoom.maxOccupancy || selectedRoom.capacity;
    if (guests < min || guests > max) {
      setError(`This room allows between ${min} and ${max} guests. You entered ${guests}.`);
      return;
    }
    const occupied = propertyReservations.some(reservation =>
      reservation.id !== editingId &&
      reservation.roomId === formData.roomId &&
      reservation.status !== "Cancelled" &&
      overlaps(formData.checkIn!, formData.checkOut!, reservation.checkIn, reservation.checkOut)
    );
    if (occupied) {
      setError("This room is already occupied for the selected dates by a PMS or OTA reservation.");
      return;
    }

    const payload: Reservation = {
      id: editingId || "",
      propertyId: selectedPropertyId,
      clientId: formData.clientId,
      roomId: formData.roomId,
      checkIn: formData.checkIn,
      checkOut: formData.checkOut,
      guests,
      price: calculatedPrice,
      status: formData.status || "Provisional",
      rateId: formData.rateId,
      discountId: useDiscount ? formData.discountId : undefined,
      taxIds: useTaxes ? formData.taxIds || [] : [],
      paymentPlanId: usePaymentPlan ? formData.paymentPlanId : undefined,
      source: formData.source || "Direct",
      residency: formData.residency || "Non Resident",
      importantNotes: formData.importantNotes || "",
    };

    if (editingId) updateReservation(editingId, payload);
    else addReservation(payload);

    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ status: "Provisional", source: "Direct", residency: "Non Resident", guests: 2 });
    setUseDiscount(false);
    setUseTaxes(true);
    setUsePaymentPlan(false);
  };

  const handleEdit = (reservation: Reservation) => {
    setEditingId(reservation.id);
    setFormData(reservation);
    setUseDiscount(Boolean(reservation.discountId));
    setUseTaxes(Boolean(reservation.taxIds?.length));
    setUsePaymentPlan(Boolean(reservation.paymentPlanId));
    setIsModalOpen(true);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto h-full flex flex-col relative">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Reservations</h2>
          <p className="text-muted-foreground">Create bookings with OTA availability, rates, discounts, taxes, payment plans, and automatic invoices.</p>
        </div>
        <Button onClick={() => { setEditingId(null); setFormData({ status: "Provisional", source: "Direct", residency: "Non Resident", guests: 2 }); setIsModalOpen(true); }}>
          New Reservation
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm flex flex-col flex-1 overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by ID or guest..." className="pl-9" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>CSV</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("excel")}>Excel</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("json")}>JSON</Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0 z-10">
              <tr>
                <th className="px-5 py-3 font-medium">ID / Guest</th>
                <th className="px-5 py-3 font-medium">Room</th>
                <th className="px-5 py-3 font-medium">Dates</th>
                <th className="px-5 py-3 font-medium">Source</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Total</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(reservation => {
                const client = clients.find(item => item.id === reservation.clientId);
                const room = rooms.find(item => item.id === reservation.roomId);
                return (
                  <tr key={reservation.id} className="bg-card border-b border-border hover:bg-muted/30">
                    <td className="px-5 py-4"><p className="font-medium">{reservation.id}</p><p className="text-muted-foreground">{client?.name}</p></td>
                    <td className="px-5 py-4 text-muted-foreground">{room?.name} ({room?.type})</td>
                    <td className="px-5 py-4 text-muted-foreground">{reservation.checkIn} to {reservation.checkOut}</td>
                    <td className="px-5 py-4">{reservation.source || "Direct"}</td>
                    <td className="px-5 py-4"><StatusPill status={reservation.status} /></td>
                    <td className="px-5 py-4 font-medium">${reservation.price}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openInvoice(reservation.id)}><Download size={16} /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(reservation)}><Edit size={16} /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => confirm("Delete this reservation?") && deleteReservation(reservation.id)}><Trash2 size={16} /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card p-6 rounded-lg border border-border max-w-4xl w-full shadow-lg max-h-[90vh] overflow-auto">
            <h3 className="text-xl font-bold mb-4">{editingId ? "Edit Reservation" : "New Reservation"}</h3>
            {error && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            <div className="grid gap-4 md:grid-cols-3">
              <Select label="Client" value={formData.clientId || ""} onChange={handleClientChange} options={clients.map(client => ({ value: client.id, label: `${client.name} (${client.category || "Direct Client"})` }))} />
              <Select label="Room" value={formData.roomId || ""} onChange={value => setFormData({ ...formData, roomId: value, rateId: "" })} options={propertyRooms.map(room => ({ value: room.id, label: `${room.name} - ${room.type} (${room.minOccupancy || 1}-${room.maxOccupancy || room.capacity} guests)` }))} />
              <InputField label="Guests" type="number" value={formData.guests?.toString()} onChange={value => setFormData({ ...formData, guests: Number(value) })} />
              <InputField label="Check-in" type="date" value={formData.checkIn} onChange={value => setFormData({ ...formData, checkIn: value, rateId: "" })} />
              <InputField label="Check-out" type="date" value={formData.checkOut} onChange={value => setFormData({ ...formData, checkOut: value, rateId: "" })} />
              <Select label="Residency" value={formData.residency || "Non Resident"} onChange={value => setFormData({ ...formData, residency: value as Reservation["residency"], rateId: "" })} options={[{ value: "Resident", label: "Resident" }, { value: "Non Resident", label: "Non Resident" }]} />
              <Select label="Source" value={formData.source || "Direct"} onChange={value => setFormData({ ...formData, source: value as Reservation["source"] })} options={["Direct", "Booking.com", "Expedia", "Airbnb", "Other OTA"].map(item => ({ value: item, label: item }))} />
              <Select label="Rate" value={formData.rateId || ""} onChange={value => setFormData({ ...formData, rateId: value })} options={availableRates.map(rate => ({ value: rate.id, label: `${rate.name} - $${rate.amount}` }))} />
              <div className="rounded-md border border-border p-3"><p className="text-sm text-muted-foreground">Calculated Total</p><p className="text-2xl font-bold">${calculatedPrice}</p><p className="text-xs text-muted-foreground">{nightsBetween(formData.checkIn, formData.checkOut)} nights</p></div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-md border border-border p-3 text-sm">
                <label className="flex items-center">
                  <input className="mr-2" type="checkbox" checked={useDiscount} onChange={event => setUseDiscount(event.target.checked)} /> Apply discount
                </label>
                {useDiscount && (
                  <div className="mt-3">
                    <Select label="Discount" value={formData.discountId || ""} onChange={value => setFormData({ ...formData, discountId: value })} options={discounts.map(item => ({ value: item.id, label: `${item.name} (${item.value}${item.valueType === "Percentage" ? "%" : ""})` }))} />
                  </div>
                )}
              </div>
              <div className="rounded-md border border-border p-3 text-sm">
                <label className="flex items-center">
                  <input className="mr-2" type="checkbox" checked={useTaxes} onChange={event => setUseTaxes(event.target.checked)} /> Apply taxes
                </label>
                {useTaxes && (
                  <div className="mt-3">
                    <Select label="Tax" value={(formData.taxIds || [])[0] || ""} onChange={value => setFormData({ ...formData, taxIds: value ? [value] : [] })} options={taxes.map(item => ({ value: item.id, label: `${item.name} (${item.value}${item.valueType === "Percentage" ? "%" : ""})` }))} />
                  </div>
                )}
              </div>
              <div className="rounded-md border border-border p-3 text-sm">
                <label className="flex items-center">
                  <input className="mr-2" type="checkbox" checked={usePaymentPlan} onChange={event => setUsePaymentPlan(event.target.checked)} /> Apply payment plan
                </label>
                {usePaymentPlan && (
                  <div className="mt-3">
                    <Select label="Payment Plan" value={formData.paymentPlanId || selectedClient?.defaultPaymentPlanId || ""} onChange={value => setFormData({ ...formData, paymentPlanId: value })} options={propertyPaymentPlans.map(plan => ({ value: plan.id, label: plan.name }))} />
                  </div>
                )}
              </div>
            </div>

            <label className="mt-5 block text-sm font-medium">
              Important Notes
              <textarea
                className="mt-1 min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Dietary preferences, exact bed setup, special guest requests, arrival details, and any internal reservation notes..."
                value={formData.importantNotes || ""}
                onChange={event => setFormData({ ...formData, importantNotes: event.target.value })}
              />
            </label>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit}>Save Reservation and Invoice</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color = status === "Fully Paid" ? "bg-green-100 text-green-800" : status === "Confirmed" ? "bg-blue-100 text-blue-800" : status === "Cancelled" ? "bg-red-100 text-red-800" : "bg-orange-100 text-orange-800";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>{status}</span>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="block text-sm font-medium">{label}
      <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={value} onChange={event => onChange(event.target.value)}>
        <option value="">Select</option>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function InputField({ label, value, onChange, type = "text" }: { label: string; value?: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block text-sm font-medium">{label}<Input className="mt-1" type={type} value={value || ""} onChange={event => onChange(event.target.value)} /></label>;
}
