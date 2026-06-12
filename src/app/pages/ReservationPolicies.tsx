import { useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ReservationPolicy, useAppContext } from "../context/AppContext";

const sections: ReservationPolicy["section"][] = [
  "Payment and Booking Policies",
  "Cancellation Policies",
  "Child Policies",
  "Room Amenities Included",
  "Important Notes",
];

export function ReservationPolicies() {
  const {
    reservationPolicies,
    addReservationPolicy,
    updateReservationPolicy,
    deleteReservationPolicy,
    selectedPropertyId,
  } = useAppContext();

  const [activeSection, setActiveSection] = useState<ReservationPolicy["section"]>("Payment and Booking Policies");
  const [form, setForm] = useState<Partial<ReservationPolicy>>({ section: activeSection });
  const [editingId, setEditingId] = useState("");

  const policies = reservationPolicies.filter(policy => policy.propertyId === selectedPropertyId && policy.section === activeSection);

  const savePolicy = () => {
    if (!form.title || !form.content) return;
    const payload: ReservationPolicy = {
      id: editingId || `pol-${Date.now()}`,
      propertyId: selectedPropertyId,
      section: activeSection,
      title: form.title,
      content: form.content,
    };
    editingId ? updateReservationPolicy(editingId, payload) : addReservationPolicy(payload);
    setForm({ section: activeSection });
    setEditingId("");
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Policies</h1>
        <p className="text-muted-foreground">Configure reservation policies that feed guest communication and invoices.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {sections.map(section => (
          <button
            key={section}
            className={`rounded-md px-4 py-2 text-sm font-medium ${activeSection === section ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            onClick={() => { setActiveSection(section); setForm({ section }); setEditingId(""); }}
          >
            {section}
          </button>
        ))}
      </div>

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 font-semibold">{editingId ? "Edit Policy" : "Add Policy"}</h2>
        <div className="grid gap-3">
          <label className="text-sm font-medium">Title<Input className="mt-1" value={form.title || ""} onChange={event => setForm({ ...form, title: event.target.value })} /></label>
          <label className="text-sm font-medium">Content<textarea className="mt-1 min-h-32 w-full rounded-md border border-input bg-background p-3 text-sm" value={form.content || ""} onChange={event => setForm({ ...form, content: event.target.value })} /></label>
          {activeSection === "Important Notes" && (
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Example notes: Family rooms are an interconnection of two or three separate rooms and will be charged as two or three rooms depending on the configuration. Rates do not include government taxes. TDL applies a 1% charge on all rates. Any government-mandated changes in taxes/fees will be implemented immediately as indicated.
            </div>
          )}
          <div className="flex justify-end"><Button onClick={savePolicy}>{editingId ? "Update Policy" : "Add Policy"}</Button></div>
        </div>
      </section>

      <section className="grid gap-3">
        {policies.map(policy => (
          <div key={policy.id} className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{policy.title}</h3>
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{policy.content}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setEditingId(policy.id); setForm(policy); }}>Edit</Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteReservationPolicy(policy.id)}>Delete</Button>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
