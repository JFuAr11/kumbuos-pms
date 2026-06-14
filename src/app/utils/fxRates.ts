import { DEFAULT_FX_THS_USD, DEFAULT_FX_USD_THS } from "./accountancy";

export type FxRateResponse = {
  requestedDate: string;
  rateDate: string;
  sourceDate: string;
  fxUsdThs: number;
  fxThsUsd: number;
  source: string;
};

export async function fetchFxRateForDate(date?: string): Promise<FxRateResponse> {
  if (!date) {
    return fallbackFxRate(date);
  }

  try {
    const response = await fetch(`/api/fx-rates?date=${encodeURIComponent(date)}`);
    if (!response.ok) throw new Error(`FX endpoint returned ${response.status}`);
    const payload = await response.json() as FxRateResponse;
    return {
      ...payload,
      fxUsdThs: Number(payload.fxUsdThs || DEFAULT_FX_USD_THS),
      fxThsUsd: Number(payload.fxThsUsd || DEFAULT_FX_THS_USD),
    };
  } catch {
    return fallbackFxRate(date);
  }
}

function fallbackFxRate(date?: string): FxRateResponse {
  const requestedDate = date || new Date().toISOString().split("T")[0];
  return {
    requestedDate,
    rateDate: requestedDate,
    sourceDate: requestedDate,
    fxUsdThs: DEFAULT_FX_USD_THS,
    fxThsUsd: DEFAULT_FX_THS_USD,
    source: "Default fallback FX",
  };
}
