import { processCommunicationDelivery } from "../src/server/communicationsDelivery";
import { readFirebaseStore, writeFirebaseStore } from "./firebase-store";

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

const openJobStatuses = new Set(["pending", "queued", "sending", "failed"]);
const terminalCampaignStatuses = new Set(["paused", "completed", "cancelled", "failed"]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.status(204);
    res.end?.();
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
    const store = await readFirebaseStore("pms");
    if (!store.exists || !store.data) {
      res.status(200).json({ ok: true, processed: 0, message: "No PMS data store exists yet." });
      return;
    }

    const payload = normalizePmsPayload(store.data as PmsPayload);
    const now = new Date();
    const campaigns = payload.communicationCampaigns as Campaign[];
    const outbox = payload.communicationOutbox as OutboxJob[];
    const events = payload.communicationEvents as Record<string, any>[];
    const activeSuppressions = new Set((payload.communicationSuppressionList || [])
      .filter((item: any) => String(item.status || "Active") === "Active")
      .map((item: any) => String(item.email || "").toLowerCase()));
    let processed = 0;
    let failed = 0;

    const dueJobs = outbox.filter((job) => isDueOpenJob(job, now));
    if (!dueJobs.length) {
      res.status(200).json({
        ok: true,
        processed: 0,
        failed: 0,
        dueJobs: 0,
        message: "No due communications jobs. Future scheduled jobs remain queued.",
      });
      return;
    }
    const dueCampaignIds = [...new Set(dueJobs.map((job) => String(job.campaignId || "")).filter(Boolean))];

    for (const campaignId of dueCampaignIds) {
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

      const batchSize = Math.min(Math.max(1, Number(rule?.batchSize || 50)), dailyRemaining);
      const jobs = dueJobs
        .filter((job) => job.campaignId === campaignId)
        .filter((job) => Number(job.attempts || 0) < Math.max(1, Number(job.maxRetries || rule?.maxRetries || 1)))
        .slice(0, batchSize);

      if (!jobs.length) continue;
      const suppressedJobs = jobs.filter((job) => activeSuppressions.has(String(job.recipientEmail || "").toLowerCase()));
      suppressedJobs.forEach((job) => {
        job.status = "suppressed";
        job.lastError = "Recipient is on the suppression list.";
        job.updatedAt = new Date().toISOString();
        events.unshift(buildCronEvent(job, "suppressed", `Cron skipped ${job.recipientEmail} because it is on the suppression list.`));
      });
      const deliverableJobs = jobs.filter((job) => !activeSuppressions.has(String(job.recipientEmail || "").toLowerCase()));
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
        const delivery = await processCommunicationDelivery({ jobs: deliverableJobs as any, sender: sender || {}, provider: provider || null });
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

    await writeFirebaseStore("pms", {
      ...payload,
      communicationCampaigns: campaigns,
      communicationOutbox: outbox,
      communicationEvents: events.slice(0, 5000),
      updatedAt: new Date().toISOString(),
    });

    res.status(200).json({ ok: true, processed, failed });
  } catch (error) {
    res.status(500).json({
      error: "Communications cron processing failed.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function isAuthorized(req: VercelRequest) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return true;
  const auth = getHeader(req, "authorization");
  const querySecret = getQuery(req, "secret");
  return auth === `Bearer ${secret}` || querySecret === secret;
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
