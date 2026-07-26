type VercelRequest = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (payload: unknown) => void;
  end?: () => void;
};

type PmsPayload = Record<string, any>;
type OutboxJob = Record<string, any>;
type Campaign = Record<string, any>;
type ProviderAccount = Record<string, any>;
type Sender = Record<string, any>;
type DeliveryResult = {
  jobId: string;
  recipientEmail: string;
  status: "sent" | "failed";
  providerMessageId?: string;
  error?: string;
};

const openJobStatuses = new Set(["pending", "queued", "sending", "failed"]);
const terminalCampaignStatuses = new Set(["paused", "completed", "cancelled", "failed"]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const runStartedAt = Date.now();

  if (req.method === "OPTIONS") {
    res.status(204);
    res.end?.();
    return;
  }

  if (getQuery(req, "health") === "1") {
    res.status(200).json({
      ok: true,
      service: "communications-cron",
      version: "health-e72c25e-plus",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!isAuthorized(req)) {
    res.status(401).json({ error: "Unauthorized communications cron request." });
    return;
  }

  try {
    const schedulerSource = getHeader(req, "x-kumbuos-scheduler") || getQuery(req, "source") || "external";
    const maxJobsPerRun = getPositiveInteger(
      getQuery(req, "maxJobs"),
      process.env.COMMUNICATIONS_CRON_MAX_JOBS,
      25,
    );
    const store = await readPmsStore(req);
    if (!store.exists || !store.data) {
      res.status(200).json({
        ok: true,
        source: schedulerSource,
        processed: 0,
        failed: 0,
        maxJobsPerRun,
        durationMs: Date.now() - runStartedAt,
        message: "No PMS data store exists yet.",
      });
      return;
    }

    const payload = normalizePmsPayload(store.data as PmsPayload);
    const now = new Date();
    const campaigns = payload.communicationCampaigns as Campaign[];
    const outbox = payload.communicationOutbox as OutboxJob[];
    const events = payload.communicationEvents as Record<string, any>[];
    const activeSuppressions = (payload.communicationSuppressionList || [])
      .filter((item: any) => String(item.status || "Active") === "Active");
    let processed = 0;
    let failed = 0;
    let suppressed = 0;
    let selectedJobs = 0;

    const dueJobs = outbox.filter((job) => isDueOpenJob(job, now));
    if (!dueJobs.length) {
      res.status(200).json({
        ok: true,
        source: schedulerSource,
        processed: 0,
        failed: 0,
        suppressed: 0,
        dueJobs: 0,
        selectedJobs: 0,
        maxJobsPerRun,
        durationMs: Date.now() - runStartedAt,
        message: "No due communications jobs. Future scheduled jobs remain queued.",
      });
      return;
    }
    const dueCampaignIds = [...new Set(dueJobs.map((job) => String(job.campaignId || "")).filter(Boolean))];

    for (const campaignId of dueCampaignIds) {
      const remainingRunCapacity = Math.max(0, maxJobsPerRun - selectedJobs);
      if (remainingRunCapacity <= 0) break;

      const campaign = campaigns.find((item) => item.id === campaignId);
      if (!campaign || terminalCampaignStatuses.has(String(campaign.status))) continue;

      const rule = payload.communicationSendingRules.find((item: any) => item.id === campaign.sendingRuleId);
      if (rule && !isWithinAllowedWindow(rule, now)) {
        campaign.status = "scheduled";
        campaign.updatedAt = new Date().toISOString();
        continue;
      }

      const dailyRemaining = getDailyRemainingCapacity(outbox, campaigns, rule, now);
      if (dailyRemaining <= 0) {
        campaign.status = "scheduled";
        campaign.updatedAt = new Date().toISOString();
        continue;
      }

      const batchSize = Math.min(Math.max(1, Number(rule?.batchSize || 50)), dailyRemaining, remainingRunCapacity);
      const jobs = dueJobs
        .filter((job) => job.campaignId === campaignId)
        .filter((job) => Number(job.attempts || 0) < Math.max(1, Number(job.maxRetries || rule?.maxRetries || 1)))
        .slice(0, batchSize);

      if (!jobs.length) continue;
      selectedJobs += jobs.length;
      const suppressedEmails = new Set(activeSuppressions
        .filter((item: any) => suppressionAppliesToCampaign(item, campaign))
        .map((item: any) => String(item.email || "").toLowerCase()));
      const suppressedJobs = jobs.filter((job) => suppressedEmails.has(String(job.recipientEmail || "").toLowerCase()));
      suppressedJobs.forEach((job) => {
        job.status = "suppressed";
        job.lastError = "Recipient is on the suppression list.";
        job.updatedAt = new Date().toISOString();
        suppressed += 1;
        events.unshift(buildCronEvent(job, "suppressed", `Cron skipped ${job.recipientEmail} because it is on the suppression list.`));
      });
      const deliverableJobs = jobs.filter((job) => !suppressedEmails.has(String(job.recipientEmail || "").toLowerCase()));
      if (!deliverableJobs.length) {
        campaign.status = resolveCampaignStatus(campaign, outbox, now);
        campaign.updatedAt = new Date().toISOString();
        continue;
      }

      const sender = payload.communicationSenders.find((item: any) => item.id === deliverableJobs[0].senderId);
      const provider = payload.communicationProviderAccounts.find((item: any) => item.id === (deliverableJobs[0].providerAccountId || sender?.providerAccountId));
      const sentAt = new Date().toISOString();

      deliverableJobs.forEach((job) => {
        job.status = "sending";
        job.attempts = Number(job.attempts || 0) + 1;
        job.updatedAt = sentAt;
      });

      try {
        const deliveryJobs = deliverableJobs.map((job) => materializeCronJob(job, payload, campaign, getRequestBaseUrl(req)));
        const delivery = await processCommunicationDelivery({ jobs: deliveryJobs as any, sender: sender || {}, provider: provider || null });
        delivery.results.forEach((result) => {
          const job = deliverableJobs.find((item) => item.id === result.jobId);
          if (!job) return;
          const retryLimit = Math.max(1, Number(job.maxRetries || rule?.maxRetries || 1));
          const canRetry = result.status === "failed" && Number(job.attempts || 0) < retryLimit;
          job.status = canRetry ? "queued" : result.status;
          job.providerMessageId = result.providerMessageId || "";
          job.lastError = result.error || "";
          job.sentAt = result.status === "sent" ? sentAt : job.sentAt;
          job.updatedAt = sentAt;
          processed += 1;
          if (result.status === "failed") failed += 1;
          if (result.status === "sent" && String(campaign.scheduleMode || "") === "Birthday") {
            const nextJob = buildNextBirthdayJob(job, sentAt);
            outbox.push(nextJob);
            events.unshift(buildCronEvent(nextJob, "queued", `Queued next annual birthday email for ${nextJob.recipientEmail}.`));
          }
          events.unshift(buildCronEvent(job, result.status === "sent" ? "sent" : "failed", result.status === "sent"
            ? `Cron sent email to ${job.recipientEmail}.`
            : `Cron failed email to ${job.recipientEmail}. ${canRetry ? "Queued for retry." : "Retry limit reached."}`, result.providerMessageId, result.error));
        });
      } catch (error) {
        deliverableJobs.forEach((job) => {
          const retryLimit = Math.max(1, Number(job.maxRetries || rule?.maxRetries || 1));
          const canRetry = Number(job.attempts || 0) < retryLimit;
          job.status = canRetry ? "queued" : "failed";
          job.lastError = error instanceof Error ? error.message : String(error);
          job.updatedAt = sentAt;
          failed += 1;
          events.unshift(buildCronEvent(job, "failed", `Cron failed email to ${job.recipientEmail}. ${canRetry ? "Queued for retry." : "Retry limit reached."}`, "", job.lastError));
        });
      }

      campaign.status = resolveCampaignStatus(campaign, outbox, now);
      campaign.updatedAt = new Date().toISOString();
    }

    await writePmsStore(req, {
      ...payload,
      communicationCampaigns: campaigns,
      communicationOutbox: outbox,
      communicationEvents: events.slice(0, 5000),
      updatedAt: new Date().toISOString(),
    });

    const remainingDueJobs = outbox.filter((job) => isDueOpenJob(job, now)).length;
    res.status(200).json({
      ok: true,
      source: schedulerSource,
      processed,
      failed,
      suppressed,
      dueJobs: dueJobs.length,
      selectedJobs,
      remainingDueJobs,
      maxJobsPerRun,
      durationMs: Date.now() - runStartedAt,
    });
  } catch (error) {
    res.status(500).json({
      error: "Communications cron processing failed.",
      detail: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - runStartedAt,
    });
  }
}

async function readPmsStore(req: VercelRequest) {
  const response = await fetch(`${getRequestBaseUrl(req)}/api/firebase-store?store=pms`, {
    headers: { Accept: "application/json" },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Firebase PMS store read failed: ${response.status} ${payload?.detail || payload?.error || response.statusText}`);
  }
  return payload as { exists?: boolean; data?: PmsPayload | null };
}

async function writePmsStore(req: VercelRequest, payload: PmsPayload) {
  const response = await fetch(`${getRequestBaseUrl(req)}/api/firebase-store?store=pms`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Firebase PMS store write failed: ${response.status} ${result?.detail || result?.error || response.statusText}`);
  }
}

function getRequestBaseUrl(req: VercelRequest) {
  const forwardedHost = getHeader(req, "x-forwarded-host");
  const host = forwardedHost || getHeader(req, "host") || process.env.VERCEL_URL || "localhost:5173";
  const forwardedProto = getHeader(req, "x-forwarded-proto");
  const protocol = forwardedProto || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${protocol}://${host}`;
}

function materializeCronJob(job: OutboxJob, payload: PmsPayload, campaign: Campaign | undefined, appOrigin: string): OutboxJob {
  const template = (payload.communicationTemplates || []).find((item: any) => item.id === job.templateId);
  const recipient = (payload.communicationRecipients || []).find((item: any) => item.id === job.recipientId);
  const property = (payload.properties || []).find((item: any) => item.id === job.propertyId);
  const assets = payload.communicationTemplateAssets || [];
  const inlineAssets = (template?.assetIds || [])
    .map((assetId: string) => assets.find((asset: any) => asset.id === assetId))
    .filter(Boolean);
  const attachmentAssets = (template?.attachmentIds || job.attachmentIds || [])
    .map((assetId: string) => assets.find((asset: any) => asset.id === assetId))
    .filter(Boolean);
  const unsubscribeUrl = `${appOrigin}/unsubscribe/${encodeURIComponent(buildUnsubscribeToken(String(job.recipientEmail || ""), String(job.campaignId || campaign?.id || "")))}`;
  const inlineAttachments = inlineAssets.map((asset: any, index: number) => ({
    name: String(asset.name || `inline-image-${index + 1}`),
    mimeType: String(asset.mimeType || "image/png"),
    size: Number(asset.size || 0),
    downloadUrl: asset.downloadUrl,
    embeddedDataUrl: asset.embeddedDataUrl,
    cid: buildInlineAssetCid(asset, index, job),
    inline: true,
  }));
  const fallbackRecipient = {
    name: job.recipientName,
    email: job.recipientEmail,
    reservationCode: "",
    checkinDate: "",
    checkoutDate: "",
    dateOfBirth: "",
    variables: {},
  };
  const htmlVars = {
    ...getRecipientVariables(recipient || fallbackRecipient, property?.name || "", unsubscribeUrl, "html"),
    ...getAttachedImageVariables(inlineAttachments, "html", "cid"),
  };
  const textVars = {
    ...getRecipientVariables(recipient || fallbackRecipient, property?.name || "", unsubscribeUrl, "text"),
    ...getAttachedImageVariables(inlineAttachments, "text", "url"),
  };
  const sourceHtml = String(template?.html || job.html || "");
  const sourceText = String(template?.plainText || job.plainText || htmlToText(sourceHtml));
  return {
    ...job,
    subject: renderString(String(template?.subject || job.subject || ""), textVars),
    html: renderString(sourceHtml, htmlVars),
    plainText: renderString(sourceText, textVars),
    attachments: [
      ...inlineAttachments,
      ...attachmentAssets.map((asset: any) => ({
        name: String(asset.name || "attachment"),
        mimeType: String(asset.mimeType || "application/octet-stream"),
        size: Number(asset.size || 0),
        downloadUrl: asset.downloadUrl,
        embeddedDataUrl: asset.embeddedDataUrl,
        inline: false,
      })),
    ],
  };
}

function renderString(value: string, variablesMap: Record<string, string>) {
  return String(value || "").replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => variablesMap[key] ?? "");
}

function getRecipientVariables(recipient: Record<string, any>, propertyName: string, unsubscribeUrl: string, mode: "html" | "text") {
  const unsubscribeValue = mode === "html"
    ? `<a href="${escapeAttribute(unsubscribeUrl)}" target="_blank" rel="noopener noreferrer">Click here to unsubscribe communications</a>`
    : `Click here to unsubscribe communications: ${unsubscribeUrl}`;
  return {
    ...(recipient.variables || {}),
    name: String(recipient.name || ""),
    email: String(recipient.email || ""),
    hotel_name: propertyName,
    property_name: propertyName,
    reservation_code: String(recipient.reservationCode || ""),
    checkin_date: String(recipient.checkinDate || ""),
    checkout_date: String(recipient.checkoutDate || ""),
    date_of_birth: String(recipient.dateOfBirth || ""),
    unsubscribe_url: unsubscribeValue,
  };
}

function getAttachedImageVariables(assets: any[], mode: "html" | "text", sourceMode: "url" | "cid" = "url") {
  return Object.fromEntries((assets || []).map((asset, index) => {
    const source = sourceMode === "cid" && asset.cid
      ? `cid:${asset.cid}`
      : String(asset.downloadUrl || asset.embeddedDataUrl || "");
    const alt = escapeAttribute(String(asset.name || `Attached image ${index + 1}`));
    const value = mode === "html"
      ? source
        ? `<img src="${escapeAttribute(source)}" alt="${alt}" style="max-width:100%;height:auto;display:block;border:0;" />`
        : ""
      : source
        ? `[Image: ${asset.name}] ${source}`
        : `[Image: ${asset.name}]`;
    return [`attached_image${index + 1}`, value];
  }));
}

function buildInlineAssetCid(asset: Record<string, any>, index: number, job: Record<string, any>) {
  const basis = `${job.id || "job"}-${asset.id || asset.name || index + 1}`;
  const safe = basis.replace(/[^a-zA-Z0-9.-]/g, "-").slice(0, 96) || `image-${index + 1}`;
  return `${safe}@kumbuos-inline`;
}

function buildUnsubscribeToken(email: string, campaignId: string) {
  return Buffer.from(`${email}|${campaignId}|${Date.now()}`).toString("base64url");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function isAuthorized(req: VercelRequest) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return true;
  const auth = getHeader(req, "authorization");
  const querySecret = getQuery(req, "secret");
  return auth === `Bearer ${secret}` || querySecret === secret;
}

function suppressionAppliesToCampaign(suppression: Record<string, any>, campaign: Campaign) {
  if (String(suppression.appliesTo || "All") === "All") return true;
  return String(campaign.type || "Operational") === "Marketing" || String(campaign.scheduleMode || "Manual") === "Birthday";
}

function isDueOpenJob(job: OutboxJob, now: Date) {
  if (!openJobStatuses.has(String(job.status))) return false;
  if (Number(job.attempts || 0) >= Math.max(1, Number(job.maxRetries || 1))) return false;
  if (!job.scheduledFor) return true;
  const scheduledFor = new Date(job.scheduledFor);
  return Number.isNaN(scheduledFor.getTime()) || scheduledFor <= now;
}

function resolveCampaignStatus(campaign: Campaign, outbox: OutboxJob[], now: Date) {
  const jobs = outbox.filter((job) => job.campaignId === campaign.id);
  const openJobs = jobs.filter((job) => openJobStatuses.has(String(job.status)) && Number(job.attempts || 0) < Math.max(1, Number(job.maxRetries || 1)));
  if (!openJobs.length) return "completed";
  if (openJobs.some((job) => isDueOpenJob(job, now))) return "sending";
  return "scheduled";
}

function buildCronEvent(job: OutboxJob, type: "sent" | "failed" | "suppressed" | "queued", message: string, providerMessageId?: string, errorDetail?: string) {
  return {
    id: `comm-event-cron-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    tenantId: job.tenantId,
    companyId: job.companyId,
    propertyId: job.propertyId,
    campaignId: job.campaignId,
    outboxJobId: job.id,
    recipientId: job.recipientId,
    recipientEmail: job.recipientEmail,
    senderId: job.senderId,
    templateId: job.templateId,
    type,
    message,
    providerMessageId,
    errorDetail,
    createdBy: "communications-cron",
    createdAt: new Date().toISOString(),
    status: "Active",
  };
}

function getDailyRemainingCapacity(outbox: OutboxJob[], campaigns: Campaign[], rule: Record<string, any> | undefined, now: Date) {
  const dailyLimit = Math.max(1, Number(rule?.dailyLimit || Number.MAX_SAFE_INTEGER));
  if (!Number.isFinite(dailyLimit) || dailyLimit >= Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
  const timezone = String(rule?.timezone || "UTC");
  const todayKey = getDateKey(now, timezone);
  const campaignIdsForRule = new Set(campaigns
    .filter((campaign) => !rule?.id || campaign.sendingRuleId === rule.id)
    .map((campaign) => campaign.id));
  const sentToday = outbox.filter((job) => {
    if (job.status !== "sent" || !job.sentAt) return false;
    if (!campaignIdsForRule.has(job.campaignId)) return false;
    return getDateKey(new Date(job.sentAt), timezone) === todayKey;
  }).length;
  return Math.max(0, dailyLimit - sentToday);
}

function isWithinAllowedWindow(rule: Record<string, any>, now: Date) {
  const from = parseTimeToMinutes(String(rule.allowedFromTime || ""));
  const to = parseTimeToMinutes(String(rule.allowedToTime || ""));
  if (from === null || to === null || from === to) return true;
  const current = getMinutesInTimezone(now, String(rule.timezone || "UTC"));
  if (from < to) return current >= from && current <= to;
  return current >= from || current <= to;
}

function parseTimeToMinutes(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return Math.max(0, Math.min(23, hour)) * 60 + Math.max(0, Math.min(59, minute));
}

function getMinutesInTimezone(date: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return Number(lookup.hour || 0) * 60 + Number(lookup.minute || 0);
  } catch {
    return date.getUTCHours() * 60 + date.getUTCMinutes();
  }
}

function getDateKey(date: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${lookup.year}-${lookup.month}-${lookup.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function buildNextBirthdayJob(job: OutboxJob, nowIso: string) {
  return {
    ...job,
    id: `comm-job-birthday-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    status: "queued",
    attempts: 0,
    providerMessageId: "",
    lastError: "",
    sentAt: "",
    scheduledFor: addYearsToIso(String(job.scheduledFor || nowIso), 1),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function addYearsToIso(value: string, years: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    fallback.setUTCFullYear(fallback.getUTCFullYear() + years);
    return fallback.toISOString();
  }
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString();
}

function normalizePmsPayload(data: PmsPayload): PmsPayload {
  return {
    ...data,
    communicationSenders: data.communicationSenders || [],
    communicationProviderAccounts: data.communicationProviderAccounts || [],
    communicationCampaigns: data.communicationCampaigns || [],
    communicationSendingRules: data.communicationSendingRules || [],
    communicationOutbox: data.communicationOutbox || [],
    communicationEvents: data.communicationEvents || [],
    communicationSuppressionList: data.communicationSuppressionList || [],
  };
}

function getHeader(req: VercelRequest, key: string) {
  const entry = Object.entries(req.headers || {}).find(([name]) => name.toLowerCase() === key.toLowerCase());
  const value = entry?.[1];
  return Array.isArray(value) ? value[0] : value || "";
}

function getQuery(req: VercelRequest, key: string) {
  const value = req.query?.[key];
  return Array.isArray(value) ? value[0] : value || "";
}

function getPositiveInteger(primary: string | undefined, fallback: string | undefined, defaultValue: number) {
  const parsed = Number(primary || fallback || defaultValue);
  if (!Number.isFinite(parsed) || parsed < 1) return defaultValue;
  return Math.floor(parsed);
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeReplyToEmails = (value?: unknown) => {
  const emails = String(value || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
  return emails.length && emails.every((email) => emailPattern.test(email)) ? emails.join(", ") : undefined;
};

async function processCommunicationDelivery({
  jobs,
  sender,
  provider,
}: {
  jobs: OutboxJob[];
  sender: Sender;
  provider?: ProviderAccount | null;
}) {
  if (!jobs.length) {
    throw new Error("At least one outbox job is required.");
  }

  if (!sender.fromEmail || !emailPattern.test(String(sender.fromEmail))) {
    throw new Error("A valid sender fromEmail is required.");
  }

  const invalidRecipient = jobs.find((job) => !emailPattern.test(String(job.recipientEmail || "")));
  if (invalidRecipient) {
    throw new Error(`Invalid recipient email: ${invalidRecipient.recipientEmail}`);
  }

  if (!provider || provider.mode === "test" || provider.provider === "Mock/Test") {
    return {
      ok: true,
      mode: "test",
      results: jobs.map((job): DeliveryResult => ({
        jobId: String(job.id),
        recipientEmail: String(job.recipientEmail),
        status: "sent",
        providerMessageId: `mock-${Date.now()}-${job.id}`,
      })),
    };
  }

  if (!provider.smtpHost || !provider.smtpPort || !provider.smtpUsername || !provider.smtpPassword) {
    throw new Error("Live SMTP delivery requires smtpHost, smtpPort, smtpUsername, and smtpPassword.");
  }

  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.default.createTransport({
    host: String(provider.smtpHost),
    port: Number(provider.smtpPort),
    secure: Boolean(provider.secure),
    auth: {
      user: String(provider.smtpUsername),
      pass: String(provider.smtpPassword),
    },
  });

  const results: DeliveryResult[] = [];

  for (const job of jobs) {
    try {
      const info = await transporter.sendMail({
        from: `"${escapeHeader(String(sender.fromName || "KumbuOS"))}" <${sender.fromEmail}>`,
        replyTo: normalizeReplyToEmails(sender.replyToEmail),
        to: String(job.recipientEmail),
        subject: String(job.subject || ""),
        text: String(job.plainText || "") || htmlToText(String(job.html || "")),
        html: String(job.html || "") || escapeHtml(String(job.plainText || "")).replace(/\n/g, "<br />"),
        attachments: buildNodemailerAttachments(Array.isArray(job.attachments) ? job.attachments : []),
      });

      results.push({
        jobId: String(job.id),
        recipientEmail: String(job.recipientEmail),
        status: "sent",
        providerMessageId: String(info.messageId || ""),
      });
    } catch (error) {
      results.push({
        jobId: String(job.id),
        recipientEmail: String(job.recipientEmail),
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { ok: true, mode: "live", results };
}

function buildNodemailerAttachments(attachments: any[]) {
  return attachments
    .filter((attachment) => attachment?.name && (attachment.downloadUrl || attachment.embeddedDataUrl))
    .map((attachment) => {
      const base = {
        filename: sanitizeAttachmentName(String(attachment.name)),
        contentType: String(attachment.mimeType || "application/octet-stream"),
        cid: attachment.inline && attachment.cid ? String(attachment.cid) : undefined,
        contentDisposition: attachment.inline ? "inline" : "attachment",
      };
      if (attachment.embeddedDataUrl) {
        return {
          ...base,
          content: decodeDataUrl(String(attachment.embeddedDataUrl)),
        };
      }
      return {
        ...base,
        path: String(attachment.downloadUrl),
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

