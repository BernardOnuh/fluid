"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type {
  Chain,
  ChainStats,
  MultiChainData,
} from "@/lib/multi-chain-data";

const CHAIN_CONFIG: Record<
  Chain,
  { label: string; color: string; unit: string }
> = {
  stellar: { label: "Stellar", color: "#0ea5e9", unit: "XLM" },
  evm: { label: "EVM", color: "#8b5cf6", unit: "ETH" },
  solana: { label: "Solana", color: "#14b8a6", unit: "SOL" },
  cosmos: { label: "Cosmos", color: "#f59e0b", unit: "ATOM" },
};

const CHAINS: Chain[] = ["stellar", "evm", "solana", "cosmos"];

function ChainStatCard({ stats, balance }: { stats: ChainStats; balance: number | null }) {
  const cfg = CHAIN_CONFIG[stats.chain];
  const successRate = stats.txCount > 0
    ? ((stats.successCount / stats.txCount) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cfg.color }} />
        <span className="text-sm font-semibold text-slate-900">{cfg.label}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-slate-500">Transactions</p>
          <p className="text-lg font-bold text-slate-900">{stats.txCount.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Success Rate</p>
          <p className="text-lg font-bold text-slate-900">{successRate}%</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Fees Spent</p>
          <p className="text-sm font-semibold text-slate-700">
            {stats.totalFeeFormatted} {cfg.unit}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Balance</p>
          <p className="text-sm font-semibold text-slate-700">
            {balance !== null ? `${balance.toLocaleString()} ${cfg.unit}` : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

function CombinedChart({ data }: { data: MultiChainData }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-600">
          Multi-Chain
        </p>
        <h3 className="mt-1 text-lg font-bold text-slate-900">
          Daily Transaction Volume
        </h3>
        <p className="mt-0.5 text-sm text-slate-500">
          Stacked daily transactions across all chains ({data.days} days)
        </p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data.dailySeries} margin={{ top: 4, right: 6, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(val: string, idx: number) =>
              idx % 5 === 0
                ? new Date(val).toLocaleDateString("en-US", { month: "short", day: "2-digit" })
                : ""
            }
            tick={{ fontSize: 12, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            labelFormatter={(val) =>
              new Intl.DateTimeFormat("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              }).format(new Date(val))
            }
          />
          <Legend />
          {CHAINS.map((chain) => (
            <Bar
              key={chain}
              dataKey={chain}
              stackId="txs"
              fill={CHAIN_CONFIG[chain].color}
              name={CHAIN_CONFIG[chain].label}
              radius={chain === "cosmos" ? [4, 4, 0, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MultiChainDashboard({ data }: { data: MultiChainData }) {
  const [activeTab, setActiveTab] = useState<Chain | "all">("all");

  const statsMap = new Map(data.chains.map((s) => [s.chain, s]));

  const visibleChains: Chain[] =
    activeTab === "all" ? CHAINS : [activeTab];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-600">
          Chains
        </p>
        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {(["all", ...CHAINS] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                activeTab === tab
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab === "all"
                ? "All Chains"
                : CHAIN_CONFIG[tab].label}
            </button>
          ))}
        </div>
        {data.source === "sample" && (
          <span className="ml-auto text-xs text-slate-400">Sample data</span>
        )}
      </div>

      {/* Per-chain stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {visibleChains.map((chain) => {
          const stats = statsMap.get(chain);
          if (!stats) return null;
          return (
            <ChainStatCard
              key={chain}
              stats={stats}
              balance={data.balances[chain]}
            />
          );
        })}
      </div>

      {/* Combined chart */}
      {activeTab === "all" && <CombinedChart data={data} />}

      {/* Single-chain chart when tab is selected */}
      {activeTab !== "all" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-slate-900">
            {CHAIN_CONFIG[activeTab].label} Daily Transactions
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={data.dailySeries}
              margin={{ top: 4, right: 6, left: 4, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(val: string, idx: number) =>
                  idx % 5 === 0
                    ? new Date(val).toLocaleDateString("en-US", { month: "short", day: "2-digit" })
                    : ""
                }
                tick={{ fontSize: 12, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                labelFormatter={(val) =>
                  new Intl.DateTimeFormat("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  }).format(new Date(val))
                }
              />
              <Bar
                dataKey={activeTab}
                fill={CHAIN_CONFIG[activeTab].color}
                name={CHAIN_CONFIG[activeTab].label}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
