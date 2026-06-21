import { randomUUID } from "crypto";
import { getFirebaseAdminStorageBucket } from "./_firebase-admin";

type VercelRequest = {
  method?: string;
  body?: string | {
    propertyId?: string;
    entryId?: string;
    source?: string;
    file?: {
      name?: string;
      mimeType?: string;
      data?: string;
    };
  };
};

type UploadBody = Exclude<VercelRequest["body"], string | undefined>;

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (payload: unknown) => void;
  end?: () => void;
};

const maxUploadBytes = 8 * 1024 * 1024;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.status(204);
    res.end?.();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = parseBody(req.body);
    const propertyId = sanitizePathSegment(body.propertyId || "");
    const entryId = sanitizePathSegment(body.entryId || "");
    const source = String(body.source || "Manual");
    const file = body.file || {};
    const name = String(file.name || "").trim();
    const mimeType = String(file.mimeType || "application/octet-stream");
    const data = String(file.data || "");

    if (!propertyId || !entryId || !name || !data) {
      res.status(400).json({ error: "propertyId, entryId, file.name, and file.data are required." });
      return;
    }

    const buffer = decodeUploadPayload(data);
    if (!buffer.length) {
      res.status(400).json({ error: "The attachment payload is empty." });
      return;
    }

    if (buffer.byteLength > maxUploadBytes) {
      res.status(413).json({ error: "Attachment is too large. Upload files up to 8 MB each." });
      return;
    }

    const bucket = getFirebaseAdminStorageBucket();
    const token = randomUUID();
    const attachmentId = `att-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const safeName = sanitizeFileName(name);
    const storagePath = `accountancy/${propertyId}/${entryId}/${attachmentId}-${safeName}`;
    const storageFile = bucket.file(storagePath);

    await storageFile.save(buffer, {
      resumable: false,
      metadata: {
        contentType: mimeType,
        metadata: {
          firebaseStorageDownloadTokens: token,
          originalName: name,
          source,
        },
      },
    });

    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(storagePath)}?alt=media&token=${encodeURIComponent(token)}`;

    res.status(200).json({
      ok: true,
      attachment: {
        id: attachmentId,
        name,
        mimeType,
        size: buffer.byteLength,
        storagePath,
        downloadUrl,
        source,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Firebase Storage attachment upload failed.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function parseBody(body: VercelRequest["body"]): Partial<UploadBody> {
  if (!body) return {};
  if (typeof body !== "string") return body;
  try {
    return JSON.parse(body) as Partial<UploadBody>;
  } catch {
    return {};
  }
}

function decodeUploadPayload(data: string) {
  const base64 = data.includes(",") ? data.split(",").pop() || "" : data;
  return Buffer.from(base64, "base64");
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120);
}

function sanitizeFileName(value: string) {
  const clean = value
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return clean || "attachment";
}
