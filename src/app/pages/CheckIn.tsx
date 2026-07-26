import { PointerEvent, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Search, UserCheck } from "lucide-react";
import { CheckInSubmission, useAppContext } from "../context/AppContext";
import { useNavigate } from "react-router";

const MARKETING_CONSENT_TEXT = "By ticking the box below, you consent to receive offers and promotions by email from KumbuKumbu Luxury Tented Camp.";
const UNSUBSCRIBE_TEXT = "You can unsubscribe at any time by contacting us at info@luxurytentedcamp.com.";
const PRIVACY_POLICY_TEXT = "Please see our Privacy Policy: www.luxurytentedcamp.com/new-privacy-policy";
const CHECK_IN_FORM_VERSION = "english-2026-07-23";

export function CheckIn() {
  const { addClient, addCheckInSubmission, reservationPolicies, selectedPropertyId, currentUser } = useAppContext();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    fullName: "",
    countryOfNationality: "",
    documentType: "Passport" as CheckInSubmission["documentType"],
    documentNumber: "",
    dateOfBirth: "",
    permanentAddress: "",
    emailAddress: "",
    marketingConsent: false,
    termsAccepted: true,
    notes: "",
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

  const handleSubmit = async () => {
    setError("");
    const missing = [
      ["Full name", formData.fullName],
      ["Country of nationality", formData.countryOfNationality],
      ["Type of document", formData.documentType],
      ["Document number", formData.documentNumber],
      ["Date of birth", formData.dateOfBirth],
      ["Permanent address", formData.permanentAddress],
      ["Email address", formData.emailAddress],
    ].filter(([, value]) => !String(value).trim()).map(([label]) => label);

    if (!selectedPropertyId) missing.push("Active property");
    if (!isValidEmail(formData.emailAddress)) missing.push("Valid email format");
    if (!signatureDataUrl) missing.push("Guest signature");
    if (!formData.termsAccepted) missing.push("Accommodation terms acceptance");
    if (missing.length) {
      setError(`Please complete or correct: ${missing.join(", ")}.`);
      return;
    }

    setSubmitting(true);
    try {
      const id = `checkin-${Date.now()}`;
      const uuid = getUuid();
      const guestSignatureUrl = signatureDataUrl;
      const submissionTime = new Date().toISOString();
      const submission: CheckInSubmission = {
        id,
        uuid,
        propertyId: selectedPropertyId,
        fullName: formData.fullName.trim(),
        countryOfNationality: formData.countryOfNationality.trim(),
        documentType: formData.documentType,
        documentNumber: formData.documentNumber.trim(),
        dateOfBirth: formData.dateOfBirth,
        permanentAddress: formData.permanentAddress.trim(),
        emailAddress: formData.emailAddress.trim().toLowerCase(),
        marketingConsentText: MARKETING_CONSENT_TEXT,
        unsubscribeText: UNSUBSCRIBE_TEXT,
        privacyPolicyText: PRIVACY_POLICY_TEXT,
        marketingConsent: formData.marketingConsent,
        marketingConsentAgree: formData.marketingConsent ? "Agree" : "Not agreed",
        guestSignatureName: `${id}-signature.png`,
        guestSignatureUrl,
        validationStatus: "Valid",
        notes: formData.notes.trim(),
        status: "Submitted",
        submittedBy: currentUser?.email || "front-desk",
        submissionTime,
        version: CHECK_IN_FORM_VERSION,
      };

      addCheckInSubmission(submission);
      addClient({
        id: `c-${Date.now()}`,
        name: submission.fullName,
        email: submission.emailAddress,
        phone: "",
        nationality: submission.countryOfNationality,
        dateOfBirth: submission.dateOfBirth,
        marketingOptIn: submission.marketingConsent,
        emails: [submission.emailAddress],
        category: "Direct Client",
      });
      alert("Check-in completed successfully!");
      navigate("/app/check-in/database");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : String(uploadError));
    } finally {
      setSubmitting(false);
    }
  };

  const startSignature = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const point = getCanvasPoint(canvas, event);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#2d2924";
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    setIsSigning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const drawSignature = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isSigning) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const point = getCanvasPoint(canvas, event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const endSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) setSignatureDataUrl(canvas.toDataURL("image/png"));
    setIsSigning(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureDataUrl("");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Guest Check-in</h2>
          <p className="text-muted-foreground">Register incoming guests and collect required official data.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search reservation by code (e.g., RR_000001) or guest name..." className="h-10 pl-10" />
          </div>
          <Button className="h-10 px-8">Search</Button>
        </div>

        <div className="mt-6 space-y-6">
          <section>
            <h3 className="mb-4 text-lg font-medium">Main Guest Information</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Full name *" value={formData.fullName} onChange={value => setFormData({ ...formData, fullName: value })} placeholder="e.g., Robert Johnson" />
              <Field label="Country of nationality *" value={formData.countryOfNationality} onChange={value => setFormData({ ...formData, countryOfNationality: value })} placeholder="e.g., United States" />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Type of document *</label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm" value={formData.documentType} onChange={event => setFormData({ ...formData, documentType: event.target.value as CheckInSubmission["documentType"] })}>
                  <option>Passport</option>
                  <option>National ID</option>
                  <option>Driver's License</option>
                  <option>Other</option>
                </select>
              </div>
              <Field label="Document number *" value={formData.documentNumber} onChange={value => setFormData({ ...formData, documentNumber: value })} placeholder="e.g., P12345678" />
              <Field label="Date of birth *" type="date" value={formData.dateOfBirth} onChange={value => setFormData({ ...formData, dateOfBirth: value })} />
              <Field label="Email address *" type="email" value={formData.emailAddress} onChange={value => setFormData({ ...formData, emailAddress: value })} placeholder="guest@example.com" />
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-foreground">Permanent address *</label>
                <textarea className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm" value={formData.permanentAddress} onChange={event => setFormData({ ...formData, permanentAddress: event.target.value })} placeholder="Street, city, region, country" />
              </div>
            </div>
          </section>

          <section className="border-t border-border pt-6">
            <h3 className="mb-4 text-lg font-medium">Marketing Consent</h3>
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4 text-sm">
              <p className="font-medium">{MARKETING_CONSENT_TEXT}</p>
              <p className="text-muted-foreground"><em>{UNSUBSCRIBE_TEXT}</em></p>
              <p className="text-muted-foreground"><em>{PRIVACY_POLICY_TEXT}</em></p>
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={formData.marketingConsent} onChange={event => setFormData({ ...formData, marketingConsent: event.target.checked })} />
                <span>Marketing Consent / Agree</span>
              </label>
            </div>
          </section>

          <section className="border-t border-border pt-6">
            <h3 className="mb-4 text-lg font-medium">Guest Signature</h3>
            <div className="rounded-lg border border-border bg-background p-3">
              <canvas
                ref={canvasRef}
                width={900}
                height={220}
                className="h-48 w-full touch-none rounded-md border border-input bg-white"
                onPointerDown={startSignature}
                onPointerMove={drawSignature}
                onPointerUp={endSignature}
                onPointerCancel={endSignature}
                onPointerLeave={() => isSigning && endSignature()}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">Sign directly on tablet, touch screen, or with the mouse.</p>
                <Button type="button" variant="outline" onClick={clearSignature}>Clear signature</Button>
              </div>
            </div>
          </section>

          <section className="border-t border-border pt-6">
            <h3 className="mb-4 text-lg font-medium">Signature & Terms</h3>
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={formData.termsAccepted} onChange={event => setFormData({ ...formData, termsAccepted: event.target.checked })} />
              <span className="text-sm text-foreground">
                The guest accepts the accommodation terms, cancellation policy, and camp rules.
                <button type="button" className="ml-2 font-medium text-primary underline-offset-4 hover:underline" onClick={openPoliciesDocument}>
                  Open policy document
                </button>
              </span>
            </label>
            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium text-foreground">Notes</label>
              <textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm" value={formData.notes} onChange={event => setFormData({ ...formData, notes: event.target.value })} placeholder="Internal notes or validation observations." />
            </div>
          </section>
        </div>

        {error && <div className="mt-5 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        <div className="mt-6 flex justify-end gap-3 border-t border-border pt-6">
          <Button variant="outline" disabled={submitting}>Cancel</Button>
          <Button className="gap-2 bg-green-600 text-white hover:bg-green-700" disabled={submitting} onClick={handleSubmit}>
            <UserCheck size={16} /> {submitting ? "Saving..." : "Complete Check-in"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, type = "text", value, onChange, placeholder }: { label: string; type?: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      <Input type={type} placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)} />
    </div>
  );
}

function getCanvasPoint(canvas: HTMLCanvasElement, event: PointerEvent<HTMLCanvasElement>) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function getUuid() {
  if ("randomUUID" in crypto) return crypto.randomUUID();
  return `uuid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
