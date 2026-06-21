import type { SystemUser, PasswordResetRequest } from "../context/AppContext";
import { migrateLegacyUserPassword, redactCredentialForStorage } from "./authSecurity";

type CredentialPayload = {
  schemaVersion?: string;
  users: SystemUser[];
  passwordResetRequests: PasswordResetRequest[];
  updatedAt?: unknown;
};

type StoreResponse = {
  ok?: boolean;
  exists?: boolean;
  data?: Partial<CredentialPayload> | null;
  error?: string;
  detail?: string;
};

export const CREDENTIAL_SCHEMA_VERSION = "kumbuos-credentials-root-baseline-v3";
const POLL_INTERVAL_MS = 4000;

export function firebaseCredentialsEnabled() {
  return Boolean(
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    import.meta.env.VITE_FIREBASE_CREDENTIAL_STORE_ID
  );
}

export function subscribeCredentials(
  onPayload: (payload: CredentialPayload) => void,
  onStatus?: (status: string) => void,
) {
  if (!firebaseCredentialsEnabled()) {
    onStatus?.("Firebase credentials sync is not configured. Using local secure credential store.");
    return () => undefined;
  }

  let active = true;
  let lastSnapshot = "";
  let hasReportedMissingRemote = false;

  const load = async () => {
    try {
      const response = await fetch("/api/firebase-store?store=credentials", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as StoreResponse | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.detail || payload?.error || `${response.status} ${response.statusText}`);
      }

      if (!payload.exists || !payload.data) {
        if (!hasReportedMissingRemote) {
          onStatus?.("Firebase credential store is ready, but no remote credential data exists yet.");
          hasReportedMissingRemote = true;
        }
        return;
      }

      const data = payload.data;
      if (data.schemaVersion !== CREDENTIAL_SCHEMA_VERSION) {
        const cleanPayload = {
          schemaVersion: CREDENTIAL_SCHEMA_VERSION,
          users: [],
          passwordResetRequests: [],
        };
        const snapshot = JSON.stringify(cleanPayload);
        if (snapshot !== lastSnapshot) {
          lastSnapshot = snapshot;
          onPayload(cleanPayload);
        }
        onStatus?.("Firebase credential store contains legacy users. It will be replaced with the clean root-owner baseline.");
        return;
      }

      const normalized = {
        schemaVersion: CREDENTIAL_SCHEMA_VERSION,
        users: data.users || [],
        passwordResetRequests: data.passwordResetRequests || [],
      };
      const snapshot = JSON.stringify(normalized);
      if (snapshot !== lastSnapshot) {
        lastSnapshot = snapshot;
        onPayload(normalized);
      }
      onStatus?.("Firebase credential store is synced in real time.");
    } catch (error) {
      if (!active) return;
      onStatus?.(`Firebase credential sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  onStatus?.("Connecting to Firebase credential store through Vercel secure bridge...");
  void load();
  const intervalId = window.setInterval(load, POLL_INTERVAL_MS);

  return () => {
    active = false;
    window.clearInterval(intervalId);
  };
}

export async function publishCredentials(users: SystemUser[], passwordResetRequests: PasswordResetRequest[]) {
  if (!firebaseCredentialsEnabled()) return;

  const secureUsers = await Promise.all(users.map(migrateLegacyUserPassword));
  const payload = {
    schemaVersion: CREDENTIAL_SCHEMA_VERSION,
    users: secureUsers.map(redactCredentialForStorage),
    passwordResetRequests,
  };

  const response = await fetch("/api/firebase-store?store=credentials", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  const result = await response.json().catch(() => null) as StoreResponse | null;

  if (!response.ok || !result?.ok) {
    throw new Error(result?.detail || result?.error || `${response.status} ${response.statusText}`);
  }
}
