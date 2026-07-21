import nodemailer from "nodemailer";

type ProviderAccount = {
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

type Sender = {
  id?: string;
  fromName?: string;
  fromEmail?: string;
  replyToEmail?: string;
};

type OutboxJob = {
  id: string;
  recipientId?: string;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  html: string;
  plainText: string;
};

type QueueBody = {
  jobs?: OutboxJob[];
  sender?: Sender;
  provider?: ProviderAccount | null;
};

type VercelRequest = {
  method?: string;
  body?: string | QueueBody;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (payload: unknown) => void;
  end?: () => void;
};

type QueueResult = {
  jobId: string;
  recipientEmail: string;
  status: "sent" | "failed";
  providerMessageId?: string;
  error?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const body = parseBody(req.body);
  const jobs = Array.isArray(body.jobs) ? body.jobs.slice(0, 100) : [];
  const sender = body.sender || {};
  const provider = body.provider || null;

  if (!jobs.length) {
    res.status(400).json({ error: "At least one outbox job is required." });
    return;
  }

  if (!sender.fromEmail || !emailPattern.test(sender.fromEmail)) {
    res.status(400).json({ error: "A valid sender fromEmail is required." });
    return;
  }

  const invalidRecipient = jobs.find((job) => !emailPattern.test(job.recipientEmail));
  if (invalidRecipient) {
    res.status(400).json({ error: `Invalid recipient email: ${invalidRecipient.recipientEmail}` });
    return;
  }

  if (!provider || provider.mode === "test" || provider.provider === "Mock/Test") {
    res.status(200).json({
      ok: true,
      mode: "test",
      results: jobs.map((job): QueueResult => ({
        jobId: job.id,
        recipientEmail: job.recipientEmail,
        status: "sent",
        providerMessageId: `mock-${Date.now()}-${job.id}`,
      })),
    });
    return;
  }

  if (!provider.smtpHost || !provider.smtpPort || !provider.smtpUsername || !provider.smtpPassword) {
    res.status(400).json({ error: "Live SMTP delivery requires smtpHost, smtpPort, smtpUsername, and smtpPassword." });
    return;
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

  const results: QueueResult[] = [];

  for (const job of jobs) {
    try {
      const info = await transporter.sendMail({
        from: `"${escapeHeader(sender.fromName || "KumbuOS")}" <${sender.fromEmail}>`,
        replyTo: sender.replyToEmail && emailPattern.test(sender.replyToEmail) ? sender.replyToEmail : undefined,
        to: job.recipientEmail,
        subject: job.subject,
        text: job.plainText || htmlToText(job.html),
        html: job.html || escapeHtml(job.plainText || "").replace(/\n/g, "<br />"),
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

  res.status(200).json({ ok: true, mode: "live", results });
}

function parseBody(body: VercelRequest["body"]): QueueBody {
  if (!body) return {};
  if (typeof body !== "string") return body;
  try {
    return JSON.parse(body) as QueueBody;
  } catch {
    return {};
  }
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
