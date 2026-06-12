import { useState } from "react";
import { Edit, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Client,
  PaymentPlan,
  PaymentPlanStep,
  Rate,
  RateAdjustment,
  Room,
  useAppContext,
} from "../context/AppContext";

type Tab = "rooms" | "rates" | "discounts" | "taxes" | "payment-plans" | "clients";

const clientCategories: NonNullable<Client["category"]>[] = ["Tour Operator", "Agency", "Direct Client", "Corporate", "Other"];
const tabs: { id: Tab; label: string }[] = [
  { id: "rooms", label: "Rooms" },
  { id: "rates", label: "Rates" },
  { id: "discounts", label: "Discounts" },
  { id: "taxes", label: "Taxes" },
  { id: "payment-plans", label: "Payment Plan" },
  { id: "clients", label: "Clients" },
];

export function Settings() {
  const {
    rooms, addRoom, updateRoom, deleteRoom,
    rates, addRate, updateRate, deleteRate,
    rateAdjustments, addRateAdjustment, updateRateAdjustment, deleteRateAdjustment,
    paymentPlans, addPaymentPlan, updatePaymentPlan, deletePaymentPlan,
    clients, addClient, updateClient, deleteClient,
    selectedPropertyId,
  } = useAppContext();

  const propertyRooms = rooms.filter(room => room.propertyId === selectedPropertyId);
  const propertyRates = rates.filter(rate => rate.propertyId === selectedPropertyId);
  const discounts = rateAdjustments.filter(item => item.propertyId === selectedPropertyId && item.kind === "Discount");
  const taxes = rateAdjustments.filter(item => item.propertyId === selectedPropertyId && item.kind === "Tax");
  const propertyPaymentPlans = paymentPlans.filter(plan => plan.propertyId === selectedPropertyId);

  const [activeTab, setActiveTab] = useState<Tab>("rooms");
  const [roomForm, setRoomForm] = useState<Partial<Room>>({ minOccupancy: 1, maxOccupancy: 2, capacity: 2 });
  const [rateForm, setRateForm] = useState<Partial<Rate>>({ residency: "Both", active: true });
  const [adjustmentForm, setAdjustmentForm] = useState<Partial<RateAdjustment>>({ valueType: "Percentage", appliesTo: "Manual Selection", taxMode: "Added", active: true });
  const [paymentPlanForm, setPaymentPlanForm] = useState<Partial<PaymentPlan>>({
    clientCategory: "All",
    active: true,
    steps: [
      { id: "step-1", label: "Deposit", timingType: "After Booking", days: 7, amountType: "Percentage", amount: 30 },
      { id: "step-2", label: "Final balance", timingType: "Before Check-in", days: 30, amountType: "Remaining Balance", amount: 0 },
    ],
  });
  const [clientForm, setClientForm] = useState<Partial<Client>>({ category: "Direct Client", marketingOptIn: false });
  const [editing, setEditing] = useState<{ type: Tab; id: string } | null>(null);

  const resetEditing = () => setEditing(null);

  const saveRoom = () => {
    if (!roomForm.name || !roomForm.type) return;
    const room: Room = {
      id: editing?.type === "rooms" ? editing.id : `rm-${Date.now()}`,
      propertyId: selectedPropertyId,
      name: roomForm.name,
      type: roomForm.type,
      capacity: Number(roomForm.capacity) || Number(roomForm.maxOccupancy) || 2,
      minOccupancy: Number(roomForm.minOccupancy) || 1,
      maxOccupancy: Number(roomForm.maxOccupancy) || Number(roomForm.capacity) || 2,
    };
    editing?.type === "rooms" ? updateRoom(editing.id, room) : addRoom(room);
    setRoomForm({ minOccupancy: 1, maxOccupancy: 2, capacity: 2 });
    resetEditing();
  };

  const saveRate = () => {
    if (!rateForm.name || !rateForm.amount || !rateForm.startDate || !rateForm.endDate || !rateForm.roomType) return;
    const rate: Rate = {
      id: editing?.type === "rates" ? editing.id : `rt-${Date.now()}`,
      propertyId: selectedPropertyId,
      name: rateForm.name,
      amount: Number(rateForm.amount),
      startDate: rateForm.startDate,
      endDate: rateForm.endDate,
      roomType: rateForm.roomType,
      residency: rateForm.residency || "Both",
      active: rateForm.active ?? true,
    };
    editing?.type === "rates" ? updateRate(editing.id, rate) : addRate(rate);
    setRateForm({ residency: "Both", active: true });
    resetEditing();
  };

  const saveAdjustment = (kind: "Discount" | "Tax") => {
    if (!adjustmentForm.name || !adjustmentForm.value) return;
    const adjustment: RateAdjustment = {
      id: editing?.type === (kind === "Discount" ? "discounts" : "taxes") ? editing.id : `${kind === "Discount" ? "disc" : "tax"}-${Date.now()}`,
      propertyId: selectedPropertyId,
      name: adjustmentForm.name,
      kind,
      valueType: adjustmentForm.valueType || "Percentage",
      value: Number(adjustmentForm.value),
      appliesTo: adjustmentForm.appliesTo || "Manual Selection",
      taxMode: kind === "Tax" ? adjustmentForm.taxMode || "Added" : undefined,
      active: adjustmentForm.active ?? true,
    };
    editing ? updateRateAdjustment(editing.id, adjustment) : addRateAdjustment(adjustment);
    setAdjustmentForm({ valueType: "Percentage", appliesTo: "Manual Selection", taxMode: "Added", active: true });
    resetEditing();
  };

  const updatePlanStep = (index: number, updates: Partial<PaymentPlanStep>) => {
    const steps = [...(paymentPlanForm.steps || [])];
    steps[index] = { ...steps[index], ...updates };
    setPaymentPlanForm({ ...paymentPlanForm, steps });
  };

  const savePaymentPlan = () => {
    if (!paymentPlanForm.name || !paymentPlanForm.steps?.length) return;
    const plan: PaymentPlan = {
      id: editing?.type === "payment-plans" ? editing.id : `pp-${Date.now()}`,
      propertyId: selectedPropertyId,
      name: paymentPlanForm.name,
      clientCategory: paymentPlanForm.clientCategory || "All",
      active: paymentPlanForm.active ?? true,
      steps: paymentPlanForm.steps,
    };
    editing?.type === "payment-plans" ? updatePaymentPlan(editing.id, plan) : addPaymentPlan(plan);
    setPaymentPlanForm({
      clientCategory: "All",
      active: true,
      steps: [
        { id: "step-1", label: "Deposit", timingType: "After Booking", days: 7, amountType: "Percentage", amount: 30 },
        { id: "step-2", label: "Final balance", timingType: "Before Check-in", days: 30, amountType: "Remaining Balance", amount: 0 },
      ],
    });
    resetEditing();
  };

  const saveClient = () => {
    if (!clientForm.name || !clientForm.email) return;
    const emails = (clientForm.emails?.length ? clientForm.emails : String(clientForm.email).split(","))
      .map(email => email.trim())
      .filter(Boolean);
    const client: Client = {
      id: editing?.type === "clients" ? editing.id : `c-${Date.now()}`,
      name: clientForm.name,
      email: emails[0] || clientForm.email,
      emails,
      phone: clientForm.phone || "",
      nationality: clientForm.nationality || "",
      category: clientForm.category || "Direct Client",
      defaultPaymentPlanId: clientForm.defaultPaymentPlanId || "",
      marketingOptIn: Boolean(clientForm.marketingOptIn),
    };
    editing?.type === "clients" ? updateClient(editing.id, client) : addClient(client);
    setClientForm({ category: "Direct Client", marketingOptIn: false });
    resetEditing();
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Configuration</h1>
        <p className="text-muted-foreground">Configure rooms, rates, discounts, taxes, payment plans, and clients for the active property.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {tabs.map(tab => (
          <button key={tab.id} className={`rounded-md px-4 py-2 text-sm font-medium ${activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`} onClick={() => { setActiveTab(tab.id); resetEditing(); }}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "rooms" && (
        <Panel title="Room Types and Occupancy">
          <div className="grid gap-3 md:grid-cols-6">
            <Field label="Room Name" value={roomForm.name} onChange={value => setRoomForm({ ...roomForm, name: value })} />
            <Field label="Type" value={roomForm.type} onChange={value => setRoomForm({ ...roomForm, type: value })} />
            <Field label="Min Occupancy" type="number" value={roomForm.minOccupancy?.toString()} onChange={value => setRoomForm({ ...roomForm, minOccupancy: Number(value) })} />
            <Field label="Max Occupancy" type="number" value={roomForm.maxOccupancy?.toString()} onChange={value => setRoomForm({ ...roomForm, maxOccupancy: Number(value), capacity: Number(value) })} />
            <Field label="Capacity" type="number" value={roomForm.capacity?.toString()} onChange={value => setRoomForm({ ...roomForm, capacity: Number(value) })} />
            <Button onClick={saveRoom}>{editing?.type === "rooms" ? "Update Room" : "Add Room"}</Button>
          </div>
          <SimpleTable headers={["Name", "Type", "Occupancy", "Actions"]} rows={propertyRooms.map(room => [
            room.name,
            room.type,
            `${room.minOccupancy || 1}-${room.maxOccupancy || room.capacity} guests`,
            <Actions key={room.id} onEdit={() => { setRoomForm(room); setEditing({ type: "rooms", id: room.id }); }} onDelete={() => deleteRoom(room.id)} />,
          ])} />
        </Panel>
      )}

      {activeTab === "rates" && (
        <Panel title="Rates by Date, Room Type, and Residency">
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Rate Name" value={rateForm.name} onChange={value => setRateForm({ ...rateForm, name: value })} />
            <Field label="Amount" type="number" value={rateForm.amount?.toString()} onChange={value => setRateForm({ ...rateForm, amount: Number(value) })} />
            <Field label="Start Date" type="date" value={rateForm.startDate} onChange={value => setRateForm({ ...rateForm, startDate: value })} />
            <Field label="End Date" type="date" value={rateForm.endDate} onChange={value => setRateForm({ ...rateForm, endDate: value })} />
            <SelectField label="Room Type" value={rateForm.roomType || ""} onChange={value => setRateForm({ ...rateForm, roomType: value })} options={[...new Set(propertyRooms.map(room => room.type))]} />
            <SelectField label="Residency" value={rateForm.residency || "Both"} onChange={value => setRateForm({ ...rateForm, residency: value as Rate["residency"] })} options={["Both", "Resident", "Non Resident"]} />
            <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm"><input type="checkbox" checked={rateForm.active ?? true} onChange={event => setRateForm({ ...rateForm, active: event.target.checked })} /> Active</label>
            <Button onClick={saveRate}>{editing?.type === "rates" ? "Update Rate" : "Add Rate"}</Button>
          </div>
          <SimpleTable headers={["Name", "Dates", "Room / Residency", "Amount", "Actions"]} rows={propertyRates.map(rate => [
            rate.name,
            `${rate.startDate || "-"} to ${rate.endDate || "-"}`,
            `${rate.roomType || "Any"} / ${rate.residency || "Both"}`,
            `$${rate.amount}`,
            <Actions key={rate.id} onEdit={() => { setRateForm(rate); setEditing({ type: "rates", id: rate.id }); }} onDelete={() => deleteRate(rate.id)} />,
          ])} />
        </Panel>
      )}

      {(activeTab === "discounts" || activeTab === "taxes") && (
        <Panel title={activeTab === "discounts" ? "Discounts" : "Taxes and Fees"}>
          <div className="grid gap-3 md:grid-cols-6">
            <Field label="Name" value={adjustmentForm.name} onChange={value => setAdjustmentForm({ ...adjustmentForm, name: value })} />
            <SelectField label="Value Type" value={adjustmentForm.valueType || "Percentage"} onChange={value => setAdjustmentForm({ ...adjustmentForm, valueType: value as RateAdjustment["valueType"] })} options={["Percentage", "Fixed"]} />
            <Field label="Value" type="number" value={adjustmentForm.value?.toString()} onChange={value => setAdjustmentForm({ ...adjustmentForm, value: Number(value) })} />
            <SelectField label="Applies To" value={adjustmentForm.appliesTo || "Manual Selection"} onChange={value => setAdjustmentForm({ ...adjustmentForm, appliesTo: value as RateAdjustment["appliesTo"] })} options={["Manual Selection", "All Reservations"]} />
            {activeTab === "taxes" && <SelectField label="Tax Mode" value={adjustmentForm.taxMode || "Added"} onChange={value => setAdjustmentForm({ ...adjustmentForm, taxMode: value as RateAdjustment["taxMode"] })} options={["Added", "Included"]} />}
            <Button onClick={() => saveAdjustment(activeTab === "discounts" ? "Discount" : "Tax")}>{editing ? "Update" : "Add"}</Button>
          </div>
          <SimpleTable headers={["Name", "Value", "Applies", "Mode", "Actions"]} rows={(activeTab === "discounts" ? discounts : taxes).map(item => [
            item.name,
            `${item.value}${item.valueType === "Percentage" ? "%" : ""}`,
            item.appliesTo,
            item.taxMode || "-",
            <Actions key={item.id} onEdit={() => { setAdjustmentForm(item); setEditing({ type: activeTab, id: item.id }); }} onDelete={() => deleteRateAdjustment(item.id)} />,
          ])} />
        </Panel>
      )}

      {activeTab === "payment-plans" && (
        <Panel title="Payment Plan">
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Plan Name" value={paymentPlanForm.name} onChange={value => setPaymentPlanForm({ ...paymentPlanForm, name: value })} />
            <SelectField label="Client Category" value={paymentPlanForm.clientCategory || "All"} onChange={value => setPaymentPlanForm({ ...paymentPlanForm, clientCategory: value as PaymentPlan["clientCategory"] })} options={["All", ...clientCategories]} />
            <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm"><input type="checkbox" checked={paymentPlanForm.active ?? true} onChange={event => setPaymentPlanForm({ ...paymentPlanForm, active: event.target.checked })} /> Active</label>
            <Button onClick={savePaymentPlan}>{editing?.type === "payment-plans" ? "Update Plan" : "Add Plan"}</Button>
          </div>
          <div className="mt-4 grid gap-3">
            {(paymentPlanForm.steps || []).map((step, index) => (
              <div key={step.id} className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-5">
                <Field label="Label" value={step.label} onChange={value => updatePlanStep(index, { label: value })} />
                <SelectField label="Timing" value={step.timingType} onChange={value => updatePlanStep(index, { timingType: value as PaymentPlanStep["timingType"] })} options={["After Booking", "Before Check-in"]} />
                <Field label="Days" type="number" value={step.days.toString()} onChange={value => updatePlanStep(index, { days: Number(value) })} />
                <SelectField label="Amount Type" value={step.amountType} onChange={value => updatePlanStep(index, { amountType: value as PaymentPlanStep["amountType"] })} options={["Percentage", "Fixed", "Remaining Balance"]} />
                <Field label="Amount" type="number" value={step.amount.toString()} onChange={value => updatePlanStep(index, { amount: Number(value) })} />
              </div>
            ))}
            <Button variant="outline" onClick={() => setPaymentPlanForm({ ...paymentPlanForm, steps: [...(paymentPlanForm.steps || []), { id: `step-${Date.now()}`, label: "Intermediate payment", timingType: "After Booking", days: 30, amountType: "Percentage", amount: 30 }] })}>Add Intermediate Payment</Button>
          </div>
          <SimpleTable headers={["Name", "Category", "Steps", "Actions"]} rows={propertyPaymentPlans.map(plan => [
            plan.name,
            plan.clientCategory || "All",
            plan.steps.length.toString(),
            <Actions key={plan.id} onEdit={() => { setPaymentPlanForm(plan); setEditing({ type: "payment-plans", id: plan.id }); }} onDelete={() => deletePaymentPlan(plan.id)} />,
          ])} />
        </Panel>
      )}

      {activeTab === "clients" && (
        <Panel title="Clients">
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Name" value={clientForm.name} onChange={value => setClientForm({ ...clientForm, name: value })} />
            <Field label="Emails (comma separated)" value={(clientForm.emails || [clientForm.email || ""]).join(", ")} onChange={value => setClientForm({ ...clientForm, email: value.split(",")[0]?.trim(), emails: value.split(",").map(item => item.trim()).filter(Boolean) })} />
            <Field label="Phone" value={clientForm.phone} onChange={value => setClientForm({ ...clientForm, phone: value })} />
            <Field label="Nationality" value={clientForm.nationality} onChange={value => setClientForm({ ...clientForm, nationality: value })} />
            <SelectField label="Category" value={clientForm.category || "Direct Client"} onChange={value => setClientForm({ ...clientForm, category: value as Client["category"] })} options={clientCategories} />
            <SelectField label="Default Payment Plan" value={clientForm.defaultPaymentPlanId || ""} onChange={value => setClientForm({ ...clientForm, defaultPaymentPlanId: value })} options={["", ...propertyPaymentPlans.map(plan => plan.id)]} labels={{ "": "None", ...Object.fromEntries(propertyPaymentPlans.map(plan => [plan.id, plan.name])) }} />
            <Button onClick={saveClient}>{editing?.type === "clients" ? "Update Client" : "Add Client"}</Button>
          </div>
          <SimpleTable headers={["Name", "Category", "Emails", "Default Plan", "Actions"]} rows={clients.map(client => [
            client.name,
            client.category || "Direct Client",
            (client.emails || [client.email]).join(", "),
            propertyPaymentPlans.find(plan => plan.id === client.defaultPaymentPlanId)?.name || "-",
            <Actions key={client.id} onEdit={() => { setClientForm(client); setEditing({ type: "clients", id: client.id }); }} onDelete={() => deleteClient(client.id)} />,
          ])} />
        </Panel>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-border bg-card p-5 shadow-sm"><h2 className="mb-4 text-lg font-semibold">{title}</h2>{children}</section>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value?: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block text-sm font-medium">{label}<Input className="mt-1" type={type} value={value || ""} onChange={event => onChange(event.target.value)} /></label>;
}

function SelectField({ label, value, onChange, options, labels = {} }: { label: string; value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <label className="block text-sm font-medium">{label}
      <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={value} onChange={event => onChange(event.target.value)}>
        {options.map(option => <option key={option} value={option}>{labels[option] || option || "None"}</option>)}
      </select>
    </label>
  );
}

function Actions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={onEdit}><Edit size={16} /></Button><Button variant="ghost" size="icon" className="text-destructive" onClick={onDelete}><Trash2 size={16} /></Button></div>;
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="mt-5 overflow-hidden rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr>{headers.map(header => <th key={header} className="p-3 font-medium">{header}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t border-border">{row.map((cell, index) => <td key={index} className="p-3">{cell}</td>)}</tr>)}
          {rows.length === 0 && <tr><td className="p-6 text-center text-muted-foreground" colSpan={headers.length}>No records yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
