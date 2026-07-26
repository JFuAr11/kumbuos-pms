# Communications Automation While Using Vercel Hobby

KumbuOS does not use Vercel Cron Jobs on the Hobby plan because Vercel Hobby blocks cron expressions that run more than once per day.

Instead, the repository uses GitHub Actions as an external scheduler:

- Workflow: `.github/workflows/communications-scheduler.yml`
- Frequency: every 5 minutes, aligned to 00, 05, 10, 15, and so on
- Endpoint called: `/api/communications-cron`
- Manual trigger: GitHub > Actions > Communications Queue Scheduler > Run workflow

## Required Configuration

Set these values in GitHub:

1. Repository variable:
   - Name: `COMMUNICATIONS_CRON_URL`
   - Value: `https://kumbuos-pms.vercel.app/api/communications-cron`

2. Repository secret:
   - Name: `COMMUNICATIONS_CRON_SECRET`
   - Value: the same value configured in Vercel as `CRON_SECRET`

Set this value in Vercel:

1. Environment variable:
   - Name: `CRON_SECRET`
   - Value: the same secret used in GitHub as `COMMUNICATIONS_CRON_SECRET`

If `COMMUNICATIONS_CRON_URL` is not set in GitHub, the workflow falls back to:

```text
https://kumbuos-pms.vercel.app/api/communications-cron
```

## How It Works

1. A Communications campaign creates individual outbox jobs, one per recipient.
2. Each outbox job has its own `scheduledFor` timestamp.
3. GitHub Actions calls the cron endpoint every 5 minutes.
4. The endpoint reads the PMS Firebase store.
5. The endpoint only processes jobs whose `scheduledFor` time is due.
6. The selected sending rule controls:
   - batch size,
   - interval between repeated scheduled jobs,
   - allowed sending time window,
   - daily sending limit,
   - maximum retries,
   - suppression-list enforcement.
7. Each result is written back to Firebase:
   - outbox job status,
   - attempts,
   - provider message id,
   - last error,
   - campaign status,
   - communication logs.

Birthday campaigns are long-running automations. After a birthday email is sent successfully, the cron endpoint queues the next annual birthday job for the same recipient.

## Manual Testing

Use either option:

1. KumbuOS UI:
   - Communications > Outbox Queue > Process Next Batch
   - This is useful for immediate manual tests.

2. GitHub Actions:
   - GitHub repository > Actions
   - Open `Communications Queue Scheduler`
   - Click `Run workflow`

## Production Upgrade Path

When the project moves to Vercel Pro, the GitHub Actions scheduler can be removed and Vercel Cron Jobs can be restored in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/communications-cron",
      "schedule": "*/5 * * * *"
    }
  ],
  "rewrites": [
    {
      "source": "/((?!api/.*).*)",
      "destination": "/index.html"
    }
  ]
}
```
