import { useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { OtaConnection, Reservation, useAppContext } from "../context/AppContext";

export function OtaSync() {
  const {
    otaConnections,
    addOtaConnection,
    updateOtaConnection,
    deleteOtaConnection,
    clients,
    rooms,
    selectedPropertyId,
    addReservation,
  } = useAppContext();

  const connections = otaConnections.filter(connection => connection.propertyId === selectedPropertyId);
  const [connectionForm, setConnectionForm] = useState<Partial<OtaConnection>>({ provider: "Booking.com", status: "Needs Attention" });
  const [otaReservation, setOtaReservation] = useState<Partial<Reservation>>({ source: "Booking.com", status: "Provisional", residency: "Non Resident", guests: 2 });

  const saveConnection = () => {
    if (!connectionForm.provider) return;
    addOtaConnection({
      id: `ota-${Date.now()}`,
      propertyId: selectedPropertyId,
      provider: connectionForm.provider,
      status: connectionForm.status || "Needs Attention",
      lastSyncAt: new Date().toISOString(),
      notes: connectionForm.notes || "Awaiting API credentials or channel manager webhook.",
    });
    setConnectionForm({ provider: "Booking.com", status: "Needs Attention" });
  };

  const simulateOtaReservation = () => {
    if (!otaReservation.clientId || !otaReservation.roomId || !otaReservation.checkIn || !otaReservation.checkOut) return;
    addReservation({
      id: "",
      propertyId: selectedPropertyId,
      clientId: otaReservation.clientId,
      roomId: otaReservation.roomId,
      checkIn: otaReservation.checkIn,
      checkOut: otaReservation.checkOut,
      price: Number(otaReservation.price) || 0,
      status: "Provisional",
      guests: Number(otaReservation.guests) || 2,
      source: otaReservation.source || "Booking.com",
      residency: otaReservation.residency || "Non Resident",
    });
    setOtaReservation({ source: "Booking.com", status: "Provisional", residency: "Non Resident", guests: 2 });
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">OTA Sync</h1>
        <p className="text-muted-foreground">Configure OTA/channel-manager connections. OTA-created reservations are saved into the PMS calendar and block room availability.</p>
      </div>

      <section className="rounded-lg border border-[#c98736]/30 bg-[#c98736]/10 p-4 text-sm">
        Real-time production sync requires Booking.com, Expedia, or channel-manager API credentials and webhooks. This module stores connector status and simulates inbound OTA bookings so PMS availability updates immediately in the local system.
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 font-semibold">Connections</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <Select label="Provider" value={connectionForm.provider || "Booking.com"} onChange={value => setConnectionForm({ ...connectionForm, provider: value as OtaConnection["provider"] })} options={["Booking.com", "Expedia", "Airbnb", "Other"]} />
          <Select label="Status" value={connectionForm.status || "Needs Attention"} onChange={value => setConnectionForm({ ...connectionForm, status: value as OtaConnection["status"] })} options={["Connected", "Disconnected", "Needs Attention"]} />
          <Field label="Notes" value={connectionForm.notes} onChange={value => setConnectionForm({ ...connectionForm, notes: value })} />
          <Button onClick={saveConnection}>Add Connection</Button>
        </div>
        <div className="mt-5 grid gap-3">
          {connections.map(connection => (
            <div key={connection.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4">
              <div>
                <p className="font-medium">{connection.provider}</p>
                <p className="text-sm text-muted-foreground">{connection.status} - {connection.notes}</p>
                <p className="text-xs text-muted-foreground">Last sync: {connection.lastSyncAt || "Never"}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => updateOtaConnection(connection.id, { status: "Connected", lastSyncAt: new Date().toISOString() })}>Mark Synced</Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteOtaConnection(connection.id)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 font-semibold">Simulate Inbound OTA Reservation</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <Select label="OTA" value={otaReservation.source || "Booking.com"} onChange={value => setOtaReservation({ ...otaReservation, source: value as Reservation["source"] })} options={["Booking.com", "Expedia", "Airbnb", "Other OTA"]} />
          <Select label="Client" value={otaReservation.clientId || ""} onChange={value => setOtaReservation({ ...otaReservation, clientId: value })} options={clients.map(client => ({ value: client.id, label: client.name }))} />
          <Select label="Room" value={otaReservation.roomId || ""} onChange={value => setOtaReservation({ ...otaReservation, roomId: value })} options={rooms.filter(room => room.propertyId === selectedPropertyId).map(room => ({ value: room.id, label: room.name }))} />
          <Field label="Guests" type="number" value={otaReservation.guests?.toString()} onChange={value => setOtaReservation({ ...otaReservation, guests: Number(value) })} />
          <Field label="Check-in" type="date" value={otaReservation.checkIn} onChange={value => setOtaReservation({ ...otaReservation, checkIn: value })} />
          <Field label="Check-out" type="date" value={otaReservation.checkOut} onChange={value => setOtaReservation({ ...otaReservation, checkOut: value })} />
          <Field label="OTA Total" type="number" value={otaReservation.price?.toString()} onChange={value => setOtaReservation({ ...otaReservation, price: Number(value) })} />
          <Button onClick={simulateOtaReservation}>Create OTA Booking</Button>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value?: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block text-sm font-medium">{label}<Input className="mt-1" type={type} value={value || ""} onChange={event => onChange(event.target.value)} /></label>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: (string | { value: string; label: string })[] }) {
  return (
    <label className="block text-sm font-medium">{label}
      <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={value} onChange={event => onChange(event.target.value)}>
        <option value="">Select</option>
        {options.map(option => typeof option === "string" ? <option key={option} value={option}>{option}</option> : <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
