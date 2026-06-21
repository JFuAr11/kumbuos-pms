import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "./_firebase-admin";

type StoreKey = "credentials" | "pms";

type VercelRequest = {
  method?: string;
  query?: { store?: string };
  body?: string | { payload?: Record<string, unknown> };
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (payload: unknown) => void;
  end?: () => void;
};

const stores: Record<StoreKey, { collection: string; documentEnv: string; fallbackDocument: string }> = {
  credentials: {
    collection: "kumbuosCredentialStore",
    documentEnv: "FIREBASE_CREDENTIAL_STORE_ID",
    fallbackDocument: "production-v3-root-baseline",
  },
  pms: {
    collection: "kumbuosPmsDataStore",
    documentEnv: "FIREBASE_PMS_STORE_ID",
    fallbackDocument: "test-v3-empty",
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.status(204);
    res.end?.();
    return;
  }

  const store = getStoreKey(req.query?.store);
  if (!store) {
    res.status(400).json({ error: "Invalid Firebase store. Use store=credentials or store=pms." });
    return;
  }

  try {
    const docRef = getStoreDoc(store);

    if (req.method === "GET") {
      const snapshot = await docRef.get();
      if (!snapshot.exists) {
        res.status(200).json({ ok: true, exists: false, data: null });
        return;
      }
      res.status(200).json({ ok: true, exists: true, data: snapshot.data() });
      return;
    }

    if (req.method === "POST" || req.method === "PUT") {
      const body = parseBody(req.body);
      const payload = body.payload;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        res.status(400).json({ error: "A JSON object payload is required." });
        return;
      }

      await docRef.set({
        ...payload,
        updatedAt: FieldValue.serverTimestamp(),
      });

      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({
      error: "Firebase Admin store operation failed.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function getStoreKey(value?: string): StoreKey | null {
  if (value === "credentials" || value === "pms") return value;
  return null;
}

function getStoreDoc(store: StoreKey) {
  const db = getFirebaseAdminDb();
  const config = stores[store];
  const documentId =
    process.env[config.documentEnv] ||
    process.env[`VITE_${config.documentEnv}`] ||
    config.fallbackDocument;

  return db.collection(config.collection).doc(documentId);
}

function parseBody(body: VercelRequest["body"]) {
  if (!body) return {};
  if (typeof body !== "string") return body;
  try {
    return JSON.parse(body) as Exclude<VercelRequest["body"], string>;
  } catch {
    return {};
  }
}
