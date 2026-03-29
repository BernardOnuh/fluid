export type Chain = "stellar" | "evm" | "solana" | "cosmos";

export interface ChainStats {
  chain: Chain;
  txCount: number;
  successCount: number;
  failedCount: number;
  totalFeeStroops: number;
  totalFeeFormatted: string;
}

export interface DailyChainPoint {
  date: string;
  stellar: number;
  evm: number;
  solana: number;
  cosmos: number;
}

export interface MultiChainData {
  chains: ChainStats[];
  dailySeries: DailyChainPoint[];
  balances: Record<Chain, number | null>;
  days: number;
  source: "live" | "sample";
}

// Generate sample daily data for the last 30 days
function generateSampleDaily(): DailyChainPoint[] {
  const points: DailyChainPoint[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    points.push({
      date: d.toISOString().slice(0, 10),
      stellar: Math.floor(80 + Math.random() * 60),
      evm: Math.floor(30 + Math.random() * 40),
      solana: Math.floor(15 + Math.random() * 25),
      cosmos: Math.floor(5 + Math.random() * 15),
    });
  }
  return points;
}

const SAMPLE_DATA: MultiChainData = {
  chains: [
    { chain: "stellar", txCount: 3420, successCount: 3310, failedCount: 110, totalFeeStroops: 342000000, totalFeeFormatted: "34.2000" },
    { chain: "evm", txCount: 1150, successCount: 1120, failedCount: 30, totalFeeStroops: 0, totalFeeFormatted: "0.0850" },
    { chain: "solana", txCount: 620, successCount: 605, failedCount: 15, totalFeeStroops: 0, totalFeeFormatted: "0.3100" },
    { chain: "cosmos", txCount: 280, successCount: 270, failedCount: 10, totalFeeStroops: 0, totalFeeFormatted: "1.4000" },
  ],
  dailySeries: generateSampleDaily(),
  balances: { stellar: 12500.42, evm: 2.35, solana: 45.8, cosmos: 320.5 },
  days: 30,
  source: "sample",
};

function getBaseUrl() {
  const value = process.env.FLUID_SERVER_URL?.trim();
  return value ? value.replace(/\/$/, "") : null;
}

function getAdminToken() {
  const value = process.env.FLUID_ADMIN_TOKEN?.trim();
  return value && value.length > 0 ? value : null;
}

export async function getMultiChainData(days = 30): Promise<MultiChainData> {
  const baseUrl = getBaseUrl();
  const token = getAdminToken();

  if (baseUrl && token) {
    try {
      const res = await fetch(`${baseUrl}/admin/multi-chain/stats?days=${days}`, {
        headers: { "x-admin-token": token },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        return { ...data, source: "live" };
      }
    } catch {
      // fall through
    }
  }

  return SAMPLE_DATA;
}
