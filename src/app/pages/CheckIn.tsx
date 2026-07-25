import { useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Search, UserCheck } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { useNavigate } from "react-router";

export function CheckIn() {
  const { addClient, reservationPolicies, selectedPropertyId } = useAppContext();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    nationality: '',
    dateOfBirth: '',
    email: '',
    phone: '',
    marketingOptIn: true,
    termsAccepted: true
  });

  const openPoliciesDocument = () => {
    const sections = [
      "Payment and Booking Policies",
      "Cancellation Policies",
      "Child Policies",
      "Room Amenities Included",
      "Important Notes",
    ];
    const policies = reservationPolicies.filter(policy => policy.propertyId === selectedPropertyId);
    const htmlSections = sections.map(section => {
      const items = policies.filter(policy => policy.section === section);
      return `
        <section>
          <h2>${escapeHtml(section)}</h2>
          ${items.length
            ? items.map(item => `<article><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.content).replace(/\n/g, "<br/>")}</p></article>`).join("")
            : "<p>No policy has been configured for this section yet.</p>"}
        </section>
      `;
    }).join("");
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Accommodation Terms and Policies</title>
          <style>
            body{font-family:Arial,sans-serif;color:#2d2924;margin:40px;line-height:1.5}
            h1{color:#c98736;margin-bottom:8px}
            h2{border-bottom:1px solid #c98736;padding-bottom:8px;margin-top:28px}
            h3{margin-bottom:4px}
            article{border:1px solid #e4d3bd;border-radius:8px;padding:14px;margin:12px 0;background:#fffaf3}
            .muted{color:#6b6258}
          </style>
        </head>
        <body>
          <h1>Accommodation Terms and Policies</h1>
          <p class="muted">Generated from the active property policy configuration.</p>
          ${htmlSections}
        </body>
      </html>
    `);
    win.document.close();
  };

  const handleSubmit = () => {
    if (!formData.firstName || !formData.lastName) {
      alert("Please fill in at least the name.");
      return;
    }
    addClient({
      id: `c-${Date.now()}`,
      name: `${formData.firstName} ${formData.lastName}`,
      email: formData.email,
      phone: formData.phone,
      nationality: formData.nationality,
      dateOfBirth: formData.dateOfBirth,
      marketingOptIn: formData.marketingOptIn,
      emails: formData.email ? [formData.email] : [],
      category: 'Direct Client'
    });
    alert("Check-in completed successfully!");
    navigate("/app/check-in/database");
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Guest Check-in</h2>
          <p className="text-muted-foreground">Register incoming guests and collect required data.</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden p-6 space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search reservation by code (e.g., RES-1043) or last name..." className="pl-10 h-10" />
          </div>
          <Button className="h-10 px-8">Search</Button>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-4">Main Guest Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5 text-foreground">First Name(s)</label>
              <Input 
                placeholder="e.g., Robert" 
                value={formData.firstName}
                onChange={e => setFormData({...formData, firstName: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5 text-foreground">Last Name</label>
              <Input 
                placeholder="e.g., Johnson" 
                value={formData.lastName}
                onChange={e => setFormData({...formData, lastName: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5 text-foreground">Document Type</label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                <option>Passport</option>
                <option>National ID</option>
                <option>Driver's License</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5 text-foreground">Document Number</label>
              <Input placeholder="e.g., P12345678" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5 text-foreground">Nationality</label>
              <Input 
                placeholder="e.g., United States" 
                value={formData.nationality}
                onChange={e => setFormData({...formData, nationality: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5 text-foreground">Date of Birth</label>
              <Input
                type="date"
                value={formData.dateOfBirth}
                onChange={e => setFormData({...formData, dateOfBirth: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5 text-foreground">Email</label>
              <Input 
                type="email" 
                placeholder="robert.j@example.com" 
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5 text-foreground">Phone</label>
              <Input 
                type="tel" 
                placeholder="+1 (555) 123-4567" 
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
              />
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-border">
          <h3 className="text-lg font-medium mb-4">Signature & Terms</h3>
          <label className="flex items-start gap-2 mb-2">
            <input 
              type="checkbox" 
              className="mt-1" 
              checked={formData.marketingOptIn}
              onChange={e => setFormData({...formData, marketingOptIn: e.target.checked})}
            />
            <span className="text-sm text-foreground">
              I agree to receive communications and special offers.
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={formData.termsAccepted}
              onChange={e => setFormData({...formData, termsAccepted: e.target.checked})}
            />
            <span className="text-sm text-foreground">
              The guest accepts the accommodation terms, cancellation policy, and camp rules.
              <button type="button" className="ml-2 font-medium text-primary underline-offset-4 hover:underline" onClick={openPoliciesDocument}>
                Open policy document
              </button>
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-border">
          <Button variant="outline">Cancel</Button>
          <Button className="gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={handleSubmit}>
            <UserCheck size={16} /> Complete Check-in
          </Button>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
