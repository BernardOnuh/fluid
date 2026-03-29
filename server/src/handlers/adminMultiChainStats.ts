import { Request, Response } from "express";
import prisma from "../utils/db";

const SUPPORTED_CHAINS = ["stellar", "evm", "solana", "cosmos"] as const;
type Chain = (typeof SUPPORTED_CHAINS)[number];

interface ChainStats {
  chain: Chain;
  txCount: number;
  successCount: number;
  failedCount: number;
  totalFeeStroops: number;
  totalFeeFormatted: string;
}

interface DailyChainPoint {
  date: string;
  stellar: number;
  evm: number;
  solana: number;
  cosmos: number;
}

export async function multiChainStatsHandler(req: Request, res: Response) {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 90);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const transactions = await (prisma as any).transaction.findMany({
    where: { createdAt: { gte: since } },
    select: {
      chain: true,
      status: true,
      costStroops: true,
      createdAt: true,
    },
  });

  // Per-chain aggregate stats
  const statsMap = new Map<Chain, ChainStats>();
  for (const chain of SUPPORTED_CHAINS) {
    statsMap.set(chain, {
      chain,
      txCount: 0,
      successCount: 0,
      failedCount: 0,
      totalFeeStroops: 0,
      totalFeeFormatted: "0",
    });
  }

  // Daily series for the combined chart
  const dailyMap = new Map<string, Record<Chain, number>>();

  for (const tx of transactions) {
    const chain = (SUPPORTED_CHAINS.includes(tx.chain) ? tx.chain : "stellar") as Chain;
    const stats = statsMap.get(chain)!;
    stats.txCount++;
    if (tx.status === "SUCCESS") stats.successCount++;
    if (tx.status === "FAILED") stats.failedCount++;
    stats.totalFeeStroops += Number(tx.costStroops);

    const dateKey = tx.createdAt.toISOString().slice(0, 10);
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, { stellar: 0, evm: 0, solana: 0, cosmos: 0 });
    }
    dailyMap.get(dateKey)![chain]++;
  }

  // Format fees (stroops → XLM / native display)
  for (const stats of statsMap.values()) {
    stats.totalFeeFormatted = (stats.totalFeeStroops / 1e7).toFixed(4);
  }

  // Build sorted daily series
  const dailySeries: DailyChainPoint[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));

  // Balances placeholder — in production these would come from on-chain queries
  const balances = {
    stellar: null as number | null,
    evm: null as number | null,
    solana: null as number | null,
    cosmos: null as number | null,
  };

  res.json({
    chains: Array.from(statsMap.values()),
    dailySeries,
    balances,
    days,
  });
}
