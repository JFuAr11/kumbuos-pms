# Communications Automation Scheduler

KumbuOS uses an external HTTP scheduler for Communications campaigns while the
project is deployed on Vercel Hobby. Vercel Hobby does not allow high-frequency
Vercel Cron Jobs, and GitHub Actions scheduled workflows are not precise enough
for production-style email delivery.

The recommended free scheduler is cron-job.org:

- Primary scheduler: cron-job.org
- Endpoint called: `/api/communications-cron`
- Recommended frequency: every 5 minutes
- Recommended method: `POST`
- Authentication: `Authorization: Bearer <CRON_SECRET>`
- Manual emergency fallback: `.github/workflows/communications-scheduler.yml`

The scheduler does not trigger GitHub. It calls the Vercel API endpoint directly
so due outbox jobs are read from Firebase, processed, and written back to
Firebase immediately.

## Required Vercel Environment Variables

Set these values in Vercel for Production, and Preview if you test preview
deployments:

```text
CRON_SECRET=use_a_long_random_secret
COMMUNICATIONS_CRON_MAX_JOBS=25
```

`CRON_SECRET` protects the endpoint. The same value must be used in cron-job.org.

`COMMUNICATIONS_CRON_MAX_JOBS` is optional. It limits how many outbox jobs one
cron execution can process, protecting Vercel serverless functions from long
runs when many emails are due at once. The URL query parameter `maxJobs` can
override it for a specific scheduler call.

## cron-job.org Setup

1. Open `https://cron-job.org`.
2. Create an account or sign in.
3. Create a new cron job.
4. Use this title:

```text
KumbuOS Communications Queue
```

5. Use this URL:

```text
https://kumbuos-pms.vercel.app/api/communications-cron?source=cron-job-org&maxJobs=25
```

6. Set the request method to:

```text
POST
```

7. Add this request header:

```text
Authorization: Bearer YOUR_CRON_SECRET_VALUE
```

8. Add this optional request header:

```text
X-KumbuOS-Scheduler: cron-job-org
```

9. Set the execution schedule to every 5 minutes.
10. Set the timezone to the timezone you want for scheduler logs. The email job
    times themselves are already saved as exact timestamps in Firebase, so the
    endpoint checks whether each job is due using the server time.
11. Save the cron job.
12. Run it manually once from cron-job.org.

Expected successful response:

```json
{
  "ok": true,
  "source": "cron-job-org",
  "processed": 0,
  "failed": 0,
  "suppressed": 0,
  "dueJobs": 0,
  "selectedJobs": 0,
  "remainingDueJobs": 0,
  "maxJobsPerRun": 25
}
```

If `processed` is `0` and the message says there are no due jobs, the scheduler
is working correctly and there were simply no emails ready to send at that
moment.

## Safe Health Check

This URL verifies that the Vercel function is deployed and reachable without
sending emails or changing Firebase:

```text
https://kumbuos-pms.vercel.app/api/communications-cron?health=1
```

It should return:

```json
{
  "ok": true,
  "service": "communications-cron"
}
```

## How The Scheduler Works

1. A Communications campaign creates one outbox job per recipient and repeat.
2. Each outbox job stores:
   - recipient,
   - sender,
   - provider,
   - template id,
   - scheduled timestamp,
   - repeat metadata,
   - status,
   - attempts,
   - traceability ids.
3. cron-job.org calls `/api/communications-cron` every 5 minutes.
4. The endpoint reads the PMS data store from Firebase.
5. It selects only jobs whose `scheduledFor` timestamp is due.
6. It respects:
   - campaign status,
   - sending rule batch size,
   - daily limit,
   - allowed sending time window,
   - max retries,
   - suppression list,
   - unsubscribes,
   - per-run limit.
7. It materializes the email from the current template, recipient variables, and
   template assets.
8. It sends through the configured provider, or marks as sent in Mock/Test mode.
9. It writes the result back to Firebase:
   - job status,
   - attempts,
   - provider message id,
   - last error,
   - campaign status,
   - communication events.

## Important Operational Rule

Use one primary scheduler only. When cron-job.org is enabled, keep GitHub Actions
as a manual fallback only. Running two schedulers on the same endpoint at the
same time can create unnecessary load and, in rare race conditions, duplicate
processing attempts.

## Manual Fallback

If cron-job.org is temporarily unavailable:

1. Open GitHub.
2. Go to the repository.
3. Open `Actions`.
4. Open `Communications Queue Scheduler`.
5. Click `Run workflow`.

This calls the same Vercel endpoint once.

## End-to-End Test

1. In KumbuOS, open Communications.
2. Create or confirm a Provider Settings record using Mock/Test mode.
3. Create or confirm a verified Sender.
4. Create a Template.
5. Create an Audience with at least one valid recipient.
6. Create a Sending Rule with:
   - batch size `1`,
   - interval `5`,
   - daily limit `20`,
   - current allowed time window,
   - timezone matching your test.
7. Create a Campaign scheduled 5 to 10 minutes in the future.
8. Confirm that Communications > Campaign Calendar shows queued jobs.
9. Wait for the cron-job.org run, or run the job manually in cron-job.org.
10. Confirm:
    - Outbox Queue changes from `queued` to `sent`,
    - Logs show a sent event,
    - Campaign status progresses to `completed` when all jobs are terminal.

For live SMTP tests, replace Mock/Test mode with the real SMTP provider settings
and send to your own email addresses first.
