type VercelRequest = {
  method?: string;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (payload: unknown) => void;
  end?: () => void;
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.status(204);
    res.end?.();
    return;
  }

  res.status(200).json({
    ok: true,
    service: "communications-cron-health",
    version: "standalone-health-v1",
    timestamp: new Date().toISOString(),
  });
}
