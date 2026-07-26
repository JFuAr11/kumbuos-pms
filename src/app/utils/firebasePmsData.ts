import type {
  AccountancyEntry,
  BookingPayment,
  CheckInSubmission,
  Client,
  CommunicationAudience,
  CommunicationCampaign,
  CommunicationCampaignStep,
  CommunicationEvent,
  CommunicationHelpTooltip,
  CommunicationImportList,
  CommunicationOutboxJob,
  CommunicationProviderAccount,
  CommunicationRecipient,
  CommunicationSender,
  CommunicationSendingRule,
  CommunicationSuppression,
  CommunicationTemplate,
  CommunicationTemplateAsset,
  CommunicationUnsubscribe,
  Company,
  NotificationAutomation,
  NotificationEmailConfig,
  OtaConnection,
  PaymentPlan,
  Property,
  Rate,
  RateAdjustment,
  Reservation,
  ReservationInvoice,
  ReservationPolicy,
  Room,
  SupplyRequest,
} from "../context/AppContext";

export type PmsDataPayload = {
  schemaVersion?: string;
  companies: Company[];
  properties: Property[];
  notifications: NotificationAutomation[];
  notificationEmailConfigs: NotificationEmailConfig[];
  clients: Client[];
  checkInSubmissions: CheckInSubmission[];
  rooms: Room[];
  rates: Rate[];
  rateAdjustments: RateAdjustment[];
  paymentPlans: PaymentPlan[];
  reservations: Reservation[];
  bookingPayments: BookingPayment[];
  invoices: ReservationInvoice[];
  otaConnections: OtaConnection[];
  reservationPolicies: ReservationPolicy[];
  supplyRequests: SupplyRequest[];
  accountancyEntries: AccountancyEntry[];
  communicationSenders: CommunicationSender[];
  communicationProviderAccounts: CommunicationProviderAccount[];
  communicationTemplates: CommunicationTemplate[];
  communicationTemplateAssets: CommunicationTemplateAsset[];
  communicationImportLists: CommunicationImportList[];
  communicationRecipients: CommunicationRecipient[];
  communicationAudiences: CommunicationAudience[];
  communicationCampaigns: CommunicationCampaign[];
  communicationCampaignSteps: CommunicationCampaignStep[];
  communicationSendingRules: CommunicationSendingRule[];
  communicationOutbox: CommunicationOutboxJob[];
  communicationEvents: CommunicationEvent[];
  communicationSuppressionList: CommunicationSuppression[];
  communicationUnsubscribes: CommunicationUnsubscribe[];
  communicationHelpTooltips: CommunicationHelpTooltip[];
  updatedAt?: unknown;
};

type StoreResponse = {
  ok?: boolean;
  exists?: boolean;
  data?: Partial<PmsDataPayload> | null;
  error?: string;
  detail?: string;
};

export const PMS_DATA_SCHEMA_VERSION = "kumbuos-empty-pms-v3";
const POLL_INTERVAL_MS = 4000;

export function firebasePmsDataEnabled() {
  return Boolean(
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    import.meta.env.VITE_FIREBASE_PMS_STORE_ID
  );
}

export function subscribePmsData(
  onPayload: (payload: PmsDataPayload) => void,
  onStatus?: (status: string) => void,
) {
  if (!firebasePmsDataEnabled()) {
    onStatus?.("Firebase PMS data sync is not configured. Using local PMS data store.");
    return () => undefined;
  }

  let active = true;
  let lastSnapshot = "";
  let hasReportedMissingRemote = false;

  const load = async () => {
    try {
      const response = await fetch("/api/firebase-store?store=pms", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as StoreResponse | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.detail || payload?.error || `${response.status} ${response.statusText}`);
      }

      if (!payload.exists || !payload.data) {
        if (!hasReportedMissingRemote) {
          onStatus?.("Firebase PMS data store is ready, but no remote PMS data exists yet.");
          hasReportedMissingRemote = true;
        }
        return;
      }

      const normalized = normalizePayload(payload.data);
      const snapshot = JSON.stringify(normalized);
      if (snapshot !== lastSnapshot) {
        lastSnapshot = snapshot;
        onPayload(normalized);
      }
      onStatus?.(
        payload.data.schemaVersion === PMS_DATA_SCHEMA_VERSION
          ? "Firebase PMS data store is synced in real time."
          : "Firebase PMS data store is synced and will be upgraded to the current KumbuOS schema on the next save."
      );
    } catch (error) {
      if (!active) return;
      onStatus?.(`Firebase PMS data sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  onStatus?.("Connecting to Firebase PMS data store through Vercel secure bridge...");
  void load();
  const intervalId = window.setInterval(load, POLL_INTERVAL_MS);

  return () => {
    active = false;
    window.clearInterval(intervalId);
  };
}

export async function publishPmsData(payload: PmsDataPayload) {
  if (!firebasePmsDataEnabled()) return;

  const response = await fetch("/api/firebase-store?store=pms", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payload: {
        ...normalizePayload(payload),
        schemaVersion: PMS_DATA_SCHEMA_VERSION,
      },
    }),
  });
  const result = await response.json().catch(() => null) as StoreResponse | null;

  if (!response.ok || !result?.ok) {
    throw new Error(result?.detail || result?.error || `${response.status} ${response.statusText}`);
  }
}

function normalizePayload(data: Partial<PmsDataPayload>): PmsDataPayload {
  return {
    schemaVersion: PMS_DATA_SCHEMA_VERSION,
    companies: data.companies || [],
    properties: data.properties || [],
    notifications: data.notifications || [],
    notificationEmailConfigs: data.notificationEmailConfigs || [],
    clients: data.clients || [],
    checkInSubmissions: data.checkInSubmissions || [],
    rooms: data.rooms || [],
    rates: data.rates || [],
    rateAdjustments: data.rateAdjustments || [],
    paymentPlans: data.paymentPlans || [],
    reservations: data.reservations || [],
    bookingPayments: data.bookingPayments || [],
    invoices: data.invoices || [],
    otaConnections: data.otaConnections || [],
    reservationPolicies: data.reservationPolicies || [],
    supplyRequests: data.supplyRequests || [],
    accountancyEntries: data.accountancyEntries || [],
    communicationSenders: data.communicationSenders || [],
    communicationProviderAccounts: data.communicationProviderAccounts || [],
    communicationTemplates: data.communicationTemplates || [],
    communicationTemplateAssets: data.communicationTemplateAssets || [],
    communicationImportLists: data.communicationImportLists || [],
    communicationRecipients: data.communicationRecipients || [],
    communicationAudiences: data.communicationAudiences || [],
    communicationCampaigns: data.communicationCampaigns || [],
    communicationCampaignSteps: data.communicationCampaignSteps || [],
    communicationSendingRules: data.communicationSendingRules || [],
    communicationOutbox: data.communicationOutbox || [],
    communicationEvents: data.communicationEvents || [],
    communicationSuppressionList: data.communicationSuppressionList || [],
    communicationUnsubscribes: data.communicationUnsubscribes || [],
    communicationHelpTooltips: data.communicationHelpTooltips || [],
  };
}
