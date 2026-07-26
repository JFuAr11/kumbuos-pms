import nodemailer from "nodemailer";

export type ProviderAccount = {
  id?: string;
  name?: string;
  provider?: "Mock/Test" | "SMTP";
  mode?: "test" | "live";
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string;
  secure?: boolean;
};

export type Sender = {
  id?: string;
  fromName?: string;
  fromEmail?: string;
  replyToEmail?: string;
};

export type DeliveryJob = {
  id: string;
  recipientId?: string;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  html: string;
  plainText: string;
  attachments?: Array<{
    name: string;
    mimeType?: string;
    size?: number;
    downloadUrl?: string;
    embeddedDataUrl?: string;
  }>;
};

export type DeliveryResult = {
  jobId: string;
  recipientEmail: string;
  status: "sent" | "failed";
  providerMessageId?: string;
  error?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function processCommunicationDelivery({
  jobs,
  sender,
  provider,
}: {
  jobs: DeliveryJob[];
  sender: Sender;
  provider?: ProviderAccount | null;
}) {
  if (!jobs.length) {
    throw new Error("At least one outbox job is required.");
  }

  if (!sender.fromEmail || !emailPattern.test(sender.fromEmail)) {
    throw new Error("A valid sender fromEmail is required.");
  }

  const invalidRecipient = jobs.find((job) => !emailPattern.test(job.recipientEmail));
  if (invalidRecipient) {
    throw new Error(`Invalid recipient email: ${invalidRecipient.recipientEmail}`);
  }

  if (!provider || provider.mode === "test" || provider.provider === "Mock/Test") {
    return {
      ok: true,
      mode: "test",
      results: jobs.map((job): DeliveryResult => ({
        jobId: job.id,
        recipientEmail: job.recipientEmail,
        status: "sent",
        providerMessageId: `mock-${Date.now()}-${job.id}`,
      })),
    };
  }

  if (!provider.smtpHost || !provider.smtpPort || !provider.smtpUsername || !provider.smtpPassword) {
    throw new Error("Live SMTP delivery requires smtpHost, smtpPort, smtpUsername, and smtpPassword.");
  }

  const transporter = nodemailer.createTransport({
    host: provider.smtpHost,
    port: Number(provider.smtpPort),
    secure: Boolean(provider.secure),
    auth: {
      user: provider.smtpUsername,
      pass: provider.smtpPassword,
    },
  });

  const results: DeliveryResult[] = [];

  for (const job of jobs) {
    try {
      const info = await transporter.sendMail({
        from: `"${escapeHeader(sender.fromName || "KumbuOS")}" <${sender.fromEmail}>`,
        replyTo: sender.replyToEmail && emailPattern.test(sender.replyToEmail) ? sender.replyToEmail : undefined,
        to: job.recipientEmail,
        subject: job.subject,
        text: job.plainText || htmlToText(job.html),
        html: job.html || escapeHtml(job.plainText || "").replace(/\n/g, "<br />"),
        attachments: buildNodemailerAttachments(job.attachments || []),
      });

      results.push({
        jobId: job.id,
        recipientEmail: job.recipientEmail,
        status: "sent",
        providerMessageId: String(info.messageId || ""),
      });
    } catch (error) {
      results.push({
        jobId: job.id,
        recipientEmail: job.recipientEmail,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { ok: true, mode: "live", results };
}

function buildNodemailerAttachments(attachments: NonNullable<DeliveryJob["attachments"]>) {
  return attachments
    .filter((attachment) => attachment.name && (attachment.downloadUrl || attachment.embeddedDataUrl))
    .map((attachment) => {
      const base = {
        filename: sanitizeAttachmentName(attachment.name),
        contentType: attachment.mimeType || "application/octet-stream",
      };
      if (attachment.embeddedDataUrl) {
        return {
          ...base,
          content: decodeDataUrl(attachment.embeddedDataUrl),
        };
      }
      return {
        ...base,
        path: attachment.downloadUrl,
      };
    });
}

function decodeDataUrl(value: string) {
  const base64 = value.includes(",") ? value.split(",").pop() || "" : value;
  return Buffer.from(base64, "base64");
}

function sanitizeAttachmentName(value: string) {
  return value.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, " ").trim() || "attachment";
}

function escapeHeader(value: string) {
  return value.replace(/[\r\n"]/g, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlToText(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
