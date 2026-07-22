import { processCommunicationDelivery, type DeliveryJob, type ProviderAccount, type Sender } from "../src/server/communicationsDelivery";

type QueueBody = {
  jobs?: DeliveryJob[];
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

  try {
    const body = parseBody(req.body);
    const jobs = Array.isArray(body.jobs) ? body.jobs.slice(0, 100) : [];
    const payload = await processCommunicationDelivery({
      jobs,
      sender: body.sender || {},
      provider: body.provider || null,
    });
    res.status(200).json(payload);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
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
