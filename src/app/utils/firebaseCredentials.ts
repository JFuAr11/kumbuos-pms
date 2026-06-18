import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { doc, getFirestore, onSnapshot, serverTimestamp, setDoc, type Firestore } from "firebase/firestore";
import type { SystemUser, PasswordResetRequest } from "../context/AppContext";
import { redactCredentialForStorage } from "./authSecurity";

type CredentialPayload = {
  users: SystemUser[];
  passwordResetRequests: PasswordResetRequest[];
  updatedAt?: unknown;
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
const CREDENTIAL_STORE_COLLECTION = "kumbuosCredentialStore";
const DEFAULT_CREDENTIAL_STORE_DOCUMENT = "production-v1-clean";

export function firebaseCredentialsEnabled() {
  return Boolean(getFirebaseConfig().apiKey && getFirebaseConfig().projectId);
}

export function subscribeCredentials(
  onPayload: (payload: CredentialPayload) => void,
  onStatus?: (status: string) => void,
) {
  const firestore = getCredentialFirestore();
  if (!firestore) {
    onStatus?.("Firebase credentials sync is not configured. Using local secure credential store.");
    return () => undefined;
  }

  onStatus?.("Connecting to Firebase credential store...");
  return onSnapshot(
    doc(firestore, CREDENTIAL_STORE_COLLECTION, getCredentialStoreDocumentId()),
    snapshot => {
      const data = snapshot.data() as Partial<CredentialPayload> | undefined;
      if (!data) {
        onStatus?.("Firebase credential store is ready, but no remote credential data exists yet.");
        return;
      }
      onPayload({
        users: data.users || [],
        passwordResetRequests: data.passwordResetRequests || [],
      });
      onStatus?.("Firebase credential store is synced in real time.");
    },
    error => {
      onStatus?.(`Firebase credential sync failed: ${error.message}`);
    },
  );
}

export async function publishCredentials(users: SystemUser[], passwordResetRequests: PasswordResetRequest[]) {
  const firestore = getCredentialFirestore();
  if (!firestore) return;

  await setDoc(doc(firestore, CREDENTIAL_STORE_COLLECTION, getCredentialStoreDocumentId()), {
    users: users.map(redactCredentialForStorage),
    passwordResetRequests,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

function getCredentialFirestore() {
  if (!firebaseCredentialsEnabled()) return null;
  if (db) return db;

  app = app || (getApps().length ? getApp() : initializeApp(getFirebaseConfig()));
  db = getFirestore(app);
  return db;
}

function getCredentialStoreDocumentId() {
  return import.meta.env.VITE_FIREBASE_CREDENTIAL_STORE_ID || DEFAULT_CREDENTIAL_STORE_DOCUMENT;
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
