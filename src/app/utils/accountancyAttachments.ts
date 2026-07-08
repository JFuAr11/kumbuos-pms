import type { AccountancyAttachment } from "../context/AppContext";

export async function uploadAccountancyAttachments(params: {
  propertyId: string;
  entryId: string;
  files: File[];
  source: AccountancyAttachment["source"];
}) {
  const attachments: AccountancyAttachment[] = [];

  for (const file of params.files) {
    const data = await fileToDataUrl(file);
    try {
      const response = await fetch("/api/accountancy-attachment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: params.propertyId,
          entryId: params.entryId,
          source: params.source,
          file: {
            name: file.name,
            mimeType: file.type || "application/octet-stream",
            data,
          },
        }),
      });

      const payload = await response.json().catch(() => null) as { attachment?: AccountancyAttachment; error?: string; detail?: string } | null;
      if (response.ok && payload?.attachment) {
        attachments.push(payload.attachment);
        continue;
      }
    } catch {
      // The embedded fallback below keeps audit traceability when Storage is not available.
    }

    attachments.push(createEmbeddedAttachment({
      propertyId: params.propertyId,
      entryId: params.entryId,
      source: params.source,
      file,
      data,
    }));
  }

  return attachments;
}

function createEmbeddedAttachment(params: {
  propertyId: string;
  entryId: string;
  source: AccountancyAttachment["source"];
  file: File;
  data: string;
}): AccountancyAttachment {
  const attachmentId = `embedded-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    id: attachmentId,
    name: params.file.name,
    mimeType: params.file.type || "application/octet-stream",
    size: params.file.size,
    storagePath: `embedded/${sanitizePathSegment(params.propertyId)}/${sanitizePathSegment(params.entryId)}/${attachmentId}`,
    downloadUrl: params.data,
    source: params.source,
    uploadedAt: new Date().toISOString(),
  };
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120) || "unknown";
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
