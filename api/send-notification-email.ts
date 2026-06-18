import nodemailer from "nodemailer";

type SenderConfig = {
  fromName?: string;
  fromEmail?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string;
  secure?: boolean;
};

type VercelRequest = {
  method?: string;
  body?: string | {
    senderConfig?: SenderConfig;
    to?: string | string[];
    subject?: string;
    message?: string;
  };
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (payload: unknown) => void;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = parseBody(req.body);
  const senderConfig = body.senderConfig || {};
  const recipients = Array.isArray(body.to) ? body.to : String(body.to || "").split(/[,\n;]/);
  const to = recipients.map(email => email.trim()).filter(Boolean);
  const subject = String(body.subject || "").trim();
  const message = String(body.message || "").trim();

  if (!to.length || to.some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    res.status(400).json({ error: "At least one valid recipient email is required." });
    return;
  }
  if (!subject || !message) {
    res.status(400).json({ error: "Subject and message are required." });
    return;
  }
  if (!senderConfig.fromEmail || !senderConfig.smtpHost || !senderConfig.smtpPort || !senderConfig.smtpUsername || !senderConfig.smtpPassword) {
    res.status(400).json({ error: "A complete sender SMTP configuration is required." });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: senderConfig.smtpHost,
    port: Number(senderConfig.smtpPort),
    secure: Boolean(senderConfig.secure),
    auth: {
      user: senderConfig.smtpUsername,
      pass: senderConfig.smtpPassword,
    },
  });

  await transporter.sendMail({
    from: `"${escapeHeader(senderConfig.fromName || "KumbuOS")}" <${senderConfig.fromEmail}>`,
    to,
    subject,
    text: message,
    html: `<div style="font-family:Arial,sans-serif;color:#2d2924;line-height:1.5">${escapeHtml(message).replace(/\n/g, "<br />")}</div>`,
  });

  res.status(200).json({ ok: true, from: senderConfig.fromEmail, to });
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHeader(value: string) {
  return value.replace(/[\r\n"]/g, "");
}
