import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { CheckCircle2, MailX, ShieldCheck } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useAppContext } from "../../context/AppContext";

type TokenPayload = {
  email: string;
  campaignId: string;
  issuedAt: string;
};

const unsubscribeReasons = [
  "I receive too many emails",
  "I am not planning to return to Africa",
  "I am no longer interested in receiving communications",
  "The content is not relevant to me",
  "I did not request these emails",
  "I prefer to be contacted only for active bookings",
  "Other reason",
];

export function CommunicationsUnsubscribe() {
  const { token = "" } = useParams();
  const {
    communicationCampaigns,
    properties,
    communicationSuppressionList,
    communicationUnsubscribes,
    addCommunicationSuppression,
    addCommunicationUnsubscribe,
    addCommunicationEvent,
  } = useAppContext();
  const decoded = useMemo(() => decodeToken(token), [token]);
  const campaign = decoded ? communicationCampaigns.find((item) => item.id === decoded.campaignId) : undefined;
  const property = campaign ? properties.find((item) => item.id === campaign.propertyId) : undefined;
  const propertyName = property?.name || "this property";
  const [email, setEmail] = useState(decoded?.email || "");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [consentPreferences, setConsentPreferences] = useState({
    bookingOperational: true,
    preArrivalOperational: true,
    marketingOffers: false,
    birthdayEmails: false,
    postStayMarketing: false,
  });
  const [formError, setFormError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const invalidLink = !decoded || (!campaign && communicationCampaigns.length > 0);

  const submit = () => {
    setFormError("");
    const normalizedEmail = email.trim().toLowerCase();

    if (!campaign || !decoded) {
      setFormError("This unsubscribe link is not connected to an available campaign yet.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setFormError("Enter a valid email address before confirming unsubscribe.");
      return;
    }
    if (!reason) {
      setFormError("Select the reason for unsubscribing before confirming.");
      return;
    }
    if (!confirmed) {
      setFormError("Confirm the checkbox before unsubscribing this email.");
      return;
    }

    const now = new Date().toISOString();
    const userId = "public-unsubscribe";
    const alreadySuppressed = communicationSuppressionList.some(
      (item) => item.propertyId === campaign.propertyId && item.email.toLowerCase() === normalizedEmail && item.status !== "Archived",
    );
    const alreadyUnsubscribed = communicationUnsubscribes.some(
      (item) => item.propertyId === campaign.propertyId && item.email.toLowerCase() === normalizedEmail && item.campaignId === campaign.id,
    );
    const notes = `Client requested unsubscribe from the public link. Reason: ${reason}. Consent center preferences: ${formatConsentPreferences(consentPreferences)}.`;

    if (!alreadySuppressed) {
      addCommunicationSuppression({
        id: `comm-suppression-${Date.now()}`,
        tenantId: campaign.tenantId,
        companyId: campaign.companyId,
        propertyId: campaign.propertyId,
        email: normalizedEmail,
        reason: "Unsubscribe",
        sourceCampaignId: campaign.id,
        notes,
        status: "Active",
        createdBy: userId,
        updatedBy: userId,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (!alreadyUnsubscribed) {
      addCommunicationUnsubscribe({
        id: `comm-unsubscribe-${Date.now()}`,
        tenantId: campaign.tenantId,
        companyId: campaign.companyId,
        propertyId: campaign.propertyId,
        email: normalizedEmail,
        token,
        campaignId: campaign.id,
        reason,
        consentPreferences,
        status: "Active",
        createdAt: now,
      });
    }
    addCommunicationEvent({
      id: `comm-event-unsubscribe-${Date.now()}`,
      tenantId: campaign.tenantId,
      companyId: campaign.companyId,
      propertyId: campaign.propertyId,
      campaignId: campaign.id,
      recipientEmail: normalizedEmail,
      type: "unsubscribed",
      message: `${normalizedEmail} unsubscribed from ${propertyName} communications through the public unsubscribe page.`,
      errorDetail: notes,
      createdBy: userId,
      createdAt: now,
      status: "Active",
    });

    setSubmitted(true);
  };

  return (
    <main className="min-h-screen bg-[#2b2721] px-4 py-10 text-white">
      <section className="mx-auto flex min-h-[78vh] max-w-2xl flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[#d18b31] bg-[#15120f] text-[#f7bc6a]">
          {submitted ? <CheckCircle2 className="h-8 w-8" /> : <MailX className="h-8 w-8" />}
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#f7bc6a]">{propertyName} Communications</p>
        <h1 className="mt-3 text-3xl font-bold">
          {submitted ? "Your unsubscribe request has been confirmed" : "Unsubscribe from email communications"}
        </h1>
        <p className="mt-4 text-base leading-7 text-white/75">
          {submitted
            ? `You have successfully unsubscribed from ${propertyName} communications. Your email has been added to the property's suppression list and will be excluded from future email campaigns.`
            : `We are sorry that you have decided to stop receiving ${propertyName} emails. Please confirm the email address, select the reason, tick the confirmation checkbox, and submit the request below.`}
        </p>

        {!submitted && (
          <div className="mt-8 w-full rounded-xl border border-[#d18b31]/45 bg-[#15120f] p-5 text-left shadow-2xl">
            {invalidLink && (
              <div className="mb-4 rounded-md border border-red-300/40 bg-red-950/40 p-3 text-sm text-red-100">
                This unsubscribe link is not valid or the connected campaign is not available.
              </div>
            )}
            <label className="block text-sm font-medium">
              <span className="mb-1 block text-[#f7bc6a]">Email address *</span>
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                className="border-[#d18b31]/45 bg-[#2b2721] text-white placeholder:text-white/45"
              />
            </label>
            <label className="mt-4 block text-sm font-medium">
              <span className="mb-1 block text-[#f7bc6a]">Reason *</span>
              <select
                className="h-11 w-full rounded-md border border-[#d18b31]/45 bg-[#2b2721] px-3 text-sm text-white"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              >
                <option value="">Select a reason</option>
                {unsubscribeReasons.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <div className="mt-5 rounded-lg border border-[#d18b31]/30 bg-[#2b2721]/70 p-4">
              <p className="text-sm font-semibold text-[#f7bc6a]">Consent Center</p>
              <p className="mt-1 text-xs leading-5 text-white/65">
                You can review communication preferences here. Booking and stay-service emails remain enabled when they are needed for an active reservation; marketing preferences below are disabled by this unsubscribe request.
              </p>
              <div className="mt-4 space-y-3">
                <ConsentOption
                  label="Booking confirmations and legally required reservation emails"
                  checked={consentPreferences.bookingOperational}
                  disabled
                  onChange={() => undefined}
                />
                <ConsentOption
                  label="Pre-arrival operational information for active stays"
                  checked={consentPreferences.preArrivalOperational}
                  disabled
                  onChange={() => undefined}
                />
                <ConsentOption
                  label="Marketing offers and newsletters"
                  checked={consentPreferences.marketingOffers}
                  onChange={(value) => setConsentPreferences(current => ({ ...current, marketingOffers: value }))}
                />
                <ConsentOption
                  label="Birthday greeting emails"
                  checked={consentPreferences.birthdayEmails}
                  onChange={(value) => setConsentPreferences(current => ({ ...current, birthdayEmails: value }))}
                />
                <ConsentOption
                  label="Post-stay marketing follow-up"
                  checked={consentPreferences.postStayMarketing}
                  onChange={(value) => setConsentPreferences(current => ({ ...current, postStayMarketing: value }))}
                />
              </div>
            </div>
            <label className="mt-5 flex items-start gap-3 text-sm text-white/80">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-[#d18b31]/60"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>I confirm that I want this email address to stop receiving marketing email communications from this property.</span>
            </label>
            {formError && <div className="mt-4 rounded-md border border-red-300/40 bg-red-950/40 p-3 text-sm text-red-100">{formError}</div>}
            <Button className="mt-5 w-full bg-[#d18b31] text-white hover:bg-[#b97624]" onClick={submit} disabled={invalidLink}>
              Confirm unsubscribe
            </Button>
          </div>
        )}

        <div className="mt-8 rounded-lg border border-white/15 bg-white/5 p-4 text-left text-sm text-white/70">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#f7bc6a]" />
            <p>
              Operational emails that are legally required or directly related to an active booking may still be sent when allowed by the property policy.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" className="mt-8 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
          <Link to="/login">Return to KumbuOS</Link>
        </Button>
      </section>
    </main>
  );
}

function ConsentOption({
  label,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={`flex items-start gap-3 text-sm ${disabled ? "text-white/45" : "text-white/80"}`}>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-[#d18b31]/60"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function formatConsentPreferences(preferences: Record<string, boolean>) {
  return Object.entries(preferences)
    .map(([key, value]) => `${key}=${value ? "agree" : "declined"}`)
    .join(", ");
}

function decodeToken(token: string): TokenPayload | null {
  if (!token) return null;
  try {
    const padded = token.padEnd(token.length + ((4 - (token.length % 4)) % 4), "=");
    const decoded = atob(padded);
    const [email, campaignId, issuedAt] = decoded.split("|");
    if (!email || !campaignId || !issuedAt || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return null;
    }
    return { email, campaignId, issuedAt };
  } catch {
    return null;
  }
}
