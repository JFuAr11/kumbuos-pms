import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { doc, getFirestore, onSnapshot, serverTimestamp, setDoc, type Firestore } from "firebase/firestore";
import type {
  AccountancyEntry,
  BookingPayment,
  Client,
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
  updatedAt?: unknown;
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

export const PMS_DATA_SCHEMA_VERSION = "kumbuos-empty-pms-v3";
const PMS_STORE_COLLECTION = "kumbuosPmsDataStore";
const DEFAULT_PMS_STORE_DOCUMENT = "test-v3-empty";

export function firebasePmsDataEnabled() {
  return Boolean(getFirebaseConfig().apiKey && getFirebaseConfig().projectId);
}

export function subscribePmsData(
  onPayload: (payload: PmsDataPayload) => void,
  onStatus?: (status: string) => void,
) {
  const firestore = getPmsFirestore();
  if (!firestore) {
    onStatus?.("Firebase PMS data sync is not configured. Using local PMS data store.");
    return () => undefined;
  }

  onStatus?.("Connecting to Firebase PMS data store...");
  return onSnapshot(
    doc(firestore, PMS_STORE_COLLECTION, getPmsStoreDocumentId()),
    snapshot => {
      const data = snapshot.data() as Partial<PmsDataPayload> | undefined;
      if (!data) {
        onStatus?.("Firebase PMS data store is ready, but no remote PMS data exists yet.");
        return;
      }

      if (data.schemaVersion !== PMS_DATA_SCHEMA_VERSION) {
        onStatus?.("Firebase PMS data store contains legacy data. It will be replaced with the clean empty KumbuOS baseline.");
        onPayload(normalizePayload({ schemaVersion: PMS_DATA_SCHEMA_VERSION }));
        return;
      }

      onPayload(normalizePayload(data));
      onStatus?.("Firebase PMS data store is synced in real time.");
    },
    error => {
      onStatus?.(`Firebase PMS data sync failed: ${error.message}`);
    },
  );
}

export async function publishPmsData(payload: PmsDataPayload) {
  const firestore = getPmsFirestore();
  if (!firestore) return;

  await setDoc(doc(firestore, PMS_STORE_COLLECTION, getPmsStoreDocumentId()), {
    ...normalizePayload(payload),
    schemaVersion: PMS_DATA_SCHEMA_VERSION,
    updatedAt: serverTimestamp(),
  });
}

function normalizePayload(data: Partial<PmsDataPayload>): PmsDataPayload {
  return {
    schemaVersion: PMS_DATA_SCHEMA_VERSION,
    companies: data.companies || [],
    properties: data.properties || [],
    notifications: data.notifications || [],
    notificationEmailConfigs: data.notificationEmailConfigs || [],
    clients: data.clients || [],
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
  };
}

function getPmsFirestore() {
  if (!firebasePmsDataEnabled()) return null;
  if (db) return db;

  app = app || (getApps().length ? getApp() : initializeApp(getFirebaseConfig()));
  db = getFirestore(app);
  return db;
}

function getPmsStoreDocumentId() {
  return import.meta.env.VITE_FIREBASE_PMS_STORE_ID || DEFAULT_PMS_STORE_DOCUMENT;
}

function getFirebaseConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  };
}
