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
    if (!response.ok || !payload?.attachment) {
      throw new Error(payload?.detail || payload?.error || `Could not upload ${file.name}.`);
    }

    attachments.push(payload.attachment);
  }

  return attachments;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
