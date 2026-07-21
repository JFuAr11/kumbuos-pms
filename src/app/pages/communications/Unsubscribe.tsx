import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { CheckCircle2, MailX, ShieldCheck } from "lucide-react";
import { Button } from "../../components/ui/button";
import { useAppContext } from "../../context/AppContext";

type TokenPayload = {
  email: string;
  campaignId: string;
  issuedAt: string;
};

export function CommunicationsUnsubscribe() {
  const { token = "" } = useParams();
  const {
    currentUser,
    communicationCampaigns,
    communicationSuppressionList,
    communicationUnsubscribes,
    addCommunicationSuppression,
    addCommunicationUnsubscribe,
  } = useAppContext();
  const [status, setStatus] = useState<"loading" | "done" | "invalid">("loading");

  const decoded = useMemo(() => decodeToken(token), [token]);
  const campaign = decoded ? communicationCampaigns.find((item) => item.id === decoded.campaignId) : undefined;

  useEffect(() => {
    if (!decoded || !campaign) {
      if (communicationCampaigns.length) {
        setStatus("invalid");
      }
      return;
    }

    const email = decoded.email.trim().toLowerCase();
    const now = new Date().toISOString();
    const userId = currentUser?.id || "public-unsubscribe";
    const alreadySuppressed = communicationSuppressionList.some(
      (item) => item.propertyId === campaign.propertyId && item.email.toLowerCase() === email && item.status !== "Archived",
    );
    const alreadyUnsubscribed = communicationUnsubscribes.some(
      (item) => item.propertyId === campaign.propertyId && item.token === token,
    );

    if (!alreadySuppressed) {
      addCommunicationSuppression({
        id: `comm-suppression-${Date.now()}`,
        tenantId: campaign.tenantId,
        companyId: campaign.companyId,
        propertyId: campaign.propertyId,
        email,
        reason: "Unsubscribe",
        sourceCampaignId: campaign.id,
        notes: "Public unsubscribe link",
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
        email,
        token,
        campaignId: campaign.id,
        reason: "Public unsubscribe link",
        status: "Active",
        createdAt: now,
      });
    }

    setStatus("done");
  }, [
    addCommunicationSuppression,
    addCommunicationUnsubscribe,
    campaign,
    communicationCampaigns.length,
    communicationSuppressionList,
    communicationUnsubscribes,
    currentUser?.id,
    decoded,
    token,
  ]);

  return (
    <main className="min-h-screen bg-[#2b2721] px-4 py-10 text-white">
      <section className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[#d18b31] bg-[#15120f] text-[#f7bc6a]">
          {status === "done" ? <CheckCircle2 className="h-8 w-8" /> : <MailX className="h-8 w-8" />}
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#f7bc6a]">KumbuOS Communications</p>
        <h1 className="mt-3 text-3xl font-bold">
          {status === "done" ? "You have been unsubscribed" : status === "invalid" ? "This unsubscribe link is not valid" : "Processing your request"}
        </h1>
        <p className="mt-4 text-base leading-7 text-white/75">
          {status === "done"
            ? "This email address has been added to the suppression list for this property. Future marketing campaigns will not be sent to it."
            : status === "invalid"
              ? "The link may be expired, incomplete, or connected to a campaign that is no longer available."
              : "Please wait while we register the unsubscribe request."}
        </p>
        <div className="mt-8 rounded-lg border border-white/15 bg-white/5 p-4 text-left text-sm text-white/70">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#f7bc6a]" />
            <p>
              Operational emails that are legally required or directly related to an active booking may still be sent when allowed by the property policy.
            </p>
          </div>
        </div>
        <Button asChild className="mt-8 bg-[#d18b31] text-white hover:bg-[#b97624]">
          <Link to="/login">Return to KumbuOS</Link>
        </Button>
      </section>
    </main>
  );
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
