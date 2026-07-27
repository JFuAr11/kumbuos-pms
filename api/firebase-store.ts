import { createSign } from "crypto";

export type StoreKey = "credentials" | "pms";

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

const firestoreScope = "https://www.googleapis.com/auth/datastore";
const chunkCollection = "payloadChunks";
const chunkSize = 700_000;
const singleDocumentStringLimit = 700_000;
let cachedAccessToken = "";
let cachedAccessTokenExpiresAt = 0;

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
    if (req.method === "GET") {
      const payload = await readFirebaseStore(store);
      res.status(200).json({ ok: true, ...payload });
      return;
    }

    if (req.method === "POST" || req.method === "PUT") {
      const body = parseBody(req.body);
      const payload = body.payload;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        res.status(400).json({ error: "A JSON object payload is required." });
        return;
      }

      await writeFirebaseStore(store, payload);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({
      error: "Firebase REST store operation failed.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function readFirebaseStore(store: StoreKey) {
  const accessToken = await getServiceAccountAccessToken();
  const url = getFirestoreDocumentUrl(store);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => ({}));

  if (response.status === 404) {
    return { exists: false, data: null };
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${payload?.error?.message || response.statusText}`);
  }

  return { exists: true, data: await decodeStoreDocument(store, payload, accessToken) };
}

export async function writeFirebaseStore(store: StoreKey, payload: Record<string, unknown>) {
  const accessToken = await getServiceAccountAccessToken();
  const url = getFirestoreDocumentUrl(store);

  const payloadJson = JSON.stringify(payload);
  if (Buffer.byteLength(payloadJson, "utf8") > singleDocumentStringLimit) {
    await writeChunkedFirebaseStore(store, payloadJson, accessToken);
    return;
  }

  const response = await fetch(`${url}?updateMask.fieldPaths=payloadJson&updateMask.fieldPaths=storageMode&updateMask.fieldPaths=chunkCount&updateMask.fieldPaths=chunkSize&updateMask.fieldPaths=payloadBytes&updateMask.fieldPaths=schemaVersion&updateMask.fieldPaths=updatedAt`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        payloadJson: { stringValue: payloadJson },
        storageMode: { stringValue: "single" },
        chunkCount: { integerValue: "0" },
        chunkSize: { integerValue: "0" },
        payloadBytes: { integerValue: String(Buffer.byteLength(payloadJson, "utf8")) },
        schemaVersion: { stringValue: String(payload.schemaVersion || "") },
        updatedAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`${response.status} ${result?.error?.message || response.statusText}`);
  }

  await deleteExistingChunkDocuments(store, accessToken);
}

function getStoreKey(value?: string): StoreKey | null {
  if (value === "credentials" || value === "pms") return value;
  return null;
}

function getFirestoreDocumentUrl(store: StoreKey) {
  const projectId = getFirebaseProjectId();
  const config = stores[store];
  const documentId =
    process.env[config.documentEnv] ||
    process.env[`VITE_${config.documentEnv}`] ||
    config.fallbackDocument;

  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${config.collection}/${encodeURIComponent(documentId)}`;
}

function getFirestoreChunkDocumentUrl(store: StoreKey, index: number) {
  return `${getFirestoreDocumentUrl(store)}/${chunkCollection}/${getChunkDocumentId(index)}`;
}

function getFirestoreChunkCollectionUrl(store: StoreKey) {
  return `${getFirestoreDocumentUrl(store)}/${chunkCollection}`;
}

function getChunkDocumentId(index: number) {
  return `chunk-${String(index).padStart(5, "0")}`;
}

function getFirebaseProjectId() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT;

  if (!projectId) {
    throw new Error("Missing Firebase project ID. Configure FIREBASE_PROJECT_ID or VITE_FIREBASE_PROJECT_ID.");
  }

  return projectId;
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

async function getServiceAccountAccessToken() {
  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt - 60_000) {
    return cachedAccessToken;
  }

  const clientEmail =
    process.env.FIREBASE_CLIENT_EMAIL ||
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    "";
  const privateKey = normalizePrivateKey(
    process.env.FIREBASE_PRIVATE_KEY ||
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
    "",
  );

  if (!clientEmail || !privateKey) {
    throw new Error("Missing Firebase service account credentials. Configure FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, or GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.");
  }

  const now = Math.floor(Date.now() / 1000);
  const assertion = [
    base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" })),
    base64Url(JSON.stringify({
      iss: clientEmail,
      scope: firestoreScope,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })),
  ].join(".");

  const signer = createSign("RSA-SHA256");
  signer.update(assertion);
  const signature = signer.sign(privateKey, "base64url");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${assertion}.${signature}`,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Google service account auth failed: ${payload?.error_description || payload?.error || response.statusText}`);
  }

  cachedAccessToken = String(payload.access_token || "");
  cachedAccessTokenExpiresAt = Date.now() + Number(payload.expires_in || 3600) * 1000;
  return cachedAccessToken;
}

function normalizePrivateKey(value: string) {
  const trimmed = String(value || "").trim();
  const unquoted = trimmed.startsWith('"') && trimmed.endsWith('"')
    ? trimmed.slice(1, -1)
    : trimmed;
  return unquoted.replace(/\\n/g, "\n");
}

function base64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

async function decodeStoreDocument(store: StoreKey, document: any, accessToken: string) {
  const fields = document?.fields || {};
  const storageMode = fields.storageMode?.stringValue;
  const chunkCount = Number(fields.chunkCount?.integerValue || fields.chunkCount?.stringValue || 0);
  if (storageMode === "chunked" || chunkCount > 0) {
    return readChunkedFirebaseStore(store, chunkCount, accessToken);
  }

  const payloadJson = fields.payloadJson?.stringValue;
  if (payloadJson) {
    try {
      return JSON.parse(payloadJson);
    } catch {
      return {};
    }
  }

  const decoded = decodeFirestoreFields(fields);
  if (decoded.payload && typeof decoded.payload === "object" && !Array.isArray(decoded.payload)) {
    return decoded.payload;
  }
  return decoded;
}

async function writeChunkedFirebaseStore(store: StoreKey, payloadJson: string, accessToken: string) {
  const chunks = splitString(payloadJson, chunkSize);
  const updatedAt = new Date().toISOString();

  for (let index = 0; index < chunks.length; index += 1) {
    const response = await fetch(getFirestoreChunkDocumentUrl(store, index), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          index: { integerValue: String(index) },
          payloadChunk: { stringValue: chunks[index] },
          updatedAt: { timestampValue: updatedAt },
        },
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Chunk ${index + 1}/${chunks.length} write failed: ${response.status} ${result?.error?.message || response.statusText}`);
    }
  }

  await deleteExistingChunkDocuments(store, accessToken, chunks.length);

  const url = getFirestoreDocumentUrl(store);
  const response = await fetch(`${url}?updateMask.fieldPaths=payloadJson&updateMask.fieldPaths=storageMode&updateMask.fieldPaths=chunkCount&updateMask.fieldPaths=chunkSize&updateMask.fieldPaths=payloadBytes&updateMask.fieldPaths=schemaVersion&updateMask.fieldPaths=updatedAt`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        storageMode: { stringValue: "chunked" },
        chunkCount: { integerValue: String(chunks.length) },
        chunkSize: { integerValue: String(chunkSize) },
        payloadBytes: { integerValue: String(Buffer.byteLength(payloadJson, "utf8")) },
        schemaVersion: { stringValue: String(JSON.parse(payloadJson).schemaVersion || "") },
        updatedAt: { timestampValue: updatedAt },
      },
    }),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`${response.status} ${result?.error?.message || response.statusText}`);
  }
}

async function readChunkedFirebaseStore(store: StoreKey, chunkCount: number, accessToken: string) {
  if (!chunkCount || chunkCount < 1) return {};
  const chunks: string[] = [];
  for (let index = 0; index < chunkCount; index += 1) {
    const response = await fetch(getFirestoreChunkDocumentUrl(store, index), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Chunk ${index + 1}/${chunkCount} read failed: ${response.status} ${payload?.error?.message || response.statusText}`);
    }
    chunks.push(String(payload?.fields?.payloadChunk?.stringValue || ""));
  }

  try {
    return JSON.parse(chunks.join(""));
  } catch {
    return {};
  }
}

async function deleteExistingChunkDocuments(store: StoreKey, accessToken: string, keepFirst = 0) {
  const response = await fetch(getFirestoreChunkCollectionUrl(store), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 404) return;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return;

  const documents = Array.isArray(payload.documents) ? payload.documents : [];
  await Promise.all(documents.map(async (document: any) => {
    const name = String(document.name || "");
    const id = name.split("/").pop() || "";
    const match = id.match(/^chunk-(\d+)$/);
    const index = match ? Number(match[1]) : Number.POSITIVE_INFINITY;
    if (Number.isFinite(index) && index < keepFirst) return;
    await fetch(`https://firestore.googleapis.com/v1/${name}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => undefined);
  }));
}

function splitString(value: string, size: number) {
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += size) {
    chunks.push(value.slice(index, index + size));
  }
  return chunks;
}

function decodeFirestoreFields(fields: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(fields || {}).map(([key, value]) => [key, decodeFirestoreValue(value)]),
  );
}

function decodeFirestoreValue(value: any): unknown {
  if (!value || typeof value !== "object") return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue?.values || []).map(decodeFirestoreValue);
  if ("mapValue" in value) return decodeFirestoreFields(value.mapValue?.fields || {});
  return null;
}
