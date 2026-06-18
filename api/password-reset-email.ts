import nodemailer from "nodemailer";

type VercelRequest = {
  method?: string;
  body?: string | {
    to?: string;
    userName?: string;
    resetUrl?: string;
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
  const to = String(body?.to || "").trim();
  const resetUrl = String(body?.resetUrl || "").trim();
  const userName = String(body?.userName || "KumbuOS user").trim();

  if (!to || !resetUrl || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    res.status(400).json({ error: "A valid recipient email and resetUrl are required." });
    return;
  }

  const user = process.env.ZOHO_SMTP_USER || "info@luxurytentedcamp.com";
  const pass = process.env.ZOHO_SMTP_PASSWORD;
  const host = process.env.ZOHO_SMTP_HOST || "smtp.zoho.eu";
  const port = Number(process.env.ZOHO_SMTP_PORT || 465);

  if (!pass) {
    res.status(500).json({ error: "ZOHO_SMTP_PASSWORD is not configured." });
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `"KumbuOS" <${user}>`,
    to,
    subject: "KumbuOS password reset",
    text: `Hello ${userName},\n\nUse this secure link to change your KumbuOS password:\n${resetUrl}\n\nIf you did not request this, ignore this email.\n\nPowered by Kumbukumbu Lodge Limited`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#2d2924;line-height:1.5">
        <h2 style="color:#c98736">KumbuOS password reset</h2>
        <p>Hello ${escapeHtml(userName)},</p>
        <p>Use the secure link below to change your KumbuOS password.</p>
        <p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#c98736;color:white;padding:12px 18px;border-radius:6px;text-decoration:none">Change password</a></p>
        <p style="font-size:13px;color:#6b6258">If you did not request this, ignore this email.</p>
        <hr style="border:none;border-top:1px solid #ead8c2;margin:24px 0" />
        <p style="font-size:12px;color:#6b6258">Powered by Kumbukumbu Lodge Limited</p>
      </div>
    `,
  });

  res.status(200).json({ ok: true, from: user });
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
