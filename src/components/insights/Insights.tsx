"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { ReadinessGauge } from "@/components/ui/ReadinessGauge";
import type {
  InsightsOutput,
  StatusDistributionItem,
  CompletionTrendPoint,
  ReadinessBand,
  ValueBalanceItem,
  ActionThroughput as ActionThroughputData,
  NeedsAttention as NeedsAttentionData,
  Momentum as MomentumData,
} from "@/lib/insights/types";

const STATUS_META: Record<string, { label: string; bar: string; dot: string }> = {
  ACTIVE: { label: "Active", bar: "bg-emerald-500", dot: "bg-emerald-500" },
  BLOCKED: { label: "Blocked", bar: "bg-red-500", dot: "bg-red-500" },
  WAITING: { label: "Waiting", bar: "bg-amber-500", dot: "bg-amber-500" },
  PAUSED: { label: "Paused", bar: "bg-zinc-400", dot: "bg-zinc-400" },
  COMPLETED: { label: "Completed", bar: "bg-sky-500", dot: "bg-sky-500" },
  ARCHIVED: { label: "Archived", bar: "bg-zinc-300", dot: "bg-zinc-300" },
  ABANDONED: { label: "Abandoned", bar: "bg-zinc-300", dot: "bg-zinc-300" },
};

export function Insights() {
  const [data, setData] = useState<InsightsOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/insights");
        if (!res.ok) throw new Error("Failed to load insights");
        const json = (await res.json()) as InsightsOutput;
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-800" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <h2 className="mb-2 text-lg font-semibold text-zinc-700">
          Couldn&apos;t load insights
        </h2>
        <p className="text-sm text-zinc-500">
          Something went wrong aggregating your data. Try refreshing the page.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Insights</h1>
          <p className="text-sm text-zinc-500">
            Trends and signals across all of your goals.
          </p>
        </div>
        <p className="text-xs text-zinc-400">
          Updated {new Date(data.generatedAt).toLocaleString()}
        </p>
      </div>

      <HeadlineStats data={data} />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CompletionTrend points={data.completionTrend} />
        </div>
        <MomentumCard momentum={data.momentum} />

        <StatusDistribution items={data.statusDistribution} total={data.headline.totalGoals} />
        <ReadinessDistribution bands={data.readinessDistribution} />
        <ActionThroughputCard data={data.actionThroughput} />

        <div className="lg:col-span-2">
          <ValueBalance items={data.valueBalance} />
        </div>
        <NeedsAttention data={data.needsAttention} />
      </div>
    </div>
  );
}

// ─── Headline stats ──────────────────────────────────────────────

function HeadlineStats({ data }: { data: InsightsOutput }) {
  const h = data.headline;
  const tiles: { label: string; value: string | number; accent?: string }[] = [
    { label: "Active goals", value: h.activeGoals },
    { label: "Blocked", value: h.blockedGoals, accent: h.blockedGoals > 0 ? "text-red-600" : undefined },
    { label: "Completed", value: h.completedGoals, accent: "text-sky-600" },
    { label: "Avg readiness", value: `${h.avgReadiness}%` },
    { label: "Open actions", value: h.openActions },
    { label: "Overdue actions", value: h.overdueActions, accent: h.overdueActions > 0 ? "text-red-600" : undefined },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => (
        <Card key={t.label} className="p-4">
          <p className="text-xs font-medium text-zinc-500">{t.label}</p>
          <p className={`mt-1 text-2xl font-bold ${t.accent ?? "text-zinc-900"}`}>
            {t.value}
          </p>
        </Card>
      ))}
    </div>
  );
}

// ─── Completion trend ────────────────────────────────────────────

function CompletionTrend({ points }: { points: CompletionTrendPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.completed));
  const total = points.reduce((sum, p) => sum + p.completed, 0);
  return (
    <Card className="h-full">
      <div className="flex items-baseline justify-between">
        <CardTitle>Completion trend</CardTitle>
        <span className="text-xs text-zinc-400">{total} in last 12 months</span>
      </div>
      <div className="mt-6 flex h-44 items-end gap-2">
        {points.map((p) => (
          <div key={p.monthStart} className="flex h-full flex-1 flex-col items-center gap-1">
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t bg-sky-500/80 transition-all"
                style={{ height: `${(p.completed / max) * 100}%`, minHeight: p.completed > 0 ? 4 : 0 }}
                title={`${p.completed} completed`}
              />
            </div>
            <span className="text-[10px] font-medium text-zinc-500">{p.completed}</span>
            <span className="text-[10px] text-zinc-400">{p.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Momentum ────────────────────────────────────────────────────

function MomentumCard({ momentum }: { momentum: MomentumData }) {
  return (
    <Card className="h-full">
      <CardTitle>Momentum</CardTitle>
      <div className="mt-4 flex items-center gap-4">
        <ReadinessGauge score={momentum.score} size="lg" />
        <div>
          <p className="text-lg font-bold text-zinc-900">{momentum.label}</p>
          <p className="text-xs text-zinc-500">Composite momentum score</p>
        </div>
      </div>
      <div className="mt-4 space-y-2 border-t border-zinc-100 pt-3">
        {momentum.components.map((c) => (
          <div key={c.label} className="flex items-center justify-between text-sm">
            <span className="text-zinc-500">{c.label}</span>
            <span className="font-semibold text-zinc-900">{c.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Status distribution ─────────────────────────────────────────

function StatusDistribution({
  items,
  total,
}: {
  items: StatusDistributionItem[];
  total: number;
}) {
  return (
    <Card className="h-full">
      <div className="flex items-baseline justify-between">
        <CardTitle>Goal status</CardTitle>
        <span className="text-xs text-zinc-400">{total} goals</span>
      </div>
      <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-zinc-100">
        {items.map((item) => {
          const meta = STATUS_META[item.status] ?? STATUS_META.ARCHIVED;
          return (
            <div
              key={item.status}
              className={meta.bar}
              style={{ width: `${(item.count / Math.max(1, total)) * 100}%` }}
              title={`${meta.label}: ${item.count}`}
            />
          );
        })}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
        {items.map((item) => {
          const meta = STATUS_META[item.status] ?? STATUS_META.ARCHIVED;
          return (
            <div key={item.status} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-zinc-600">
                <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                {meta.label}
              </span>
              <span className="font-semibold text-zinc-900">{item.count}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Readiness distribution ──────────────────────────────────────

function ReadinessDistribution({ bands }: { bands: ReadinessBand[] }) {
  const max = Math.max(1, ...bands.map((b) => b.count));
  const colors = ["bg-red-400", "bg-amber-400", "bg-sky-400", "bg-emerald-500"];
  return (
    <Card className="h-full">
      <CardTitle>Readiness distribution</CardTitle>
      <p className="mt-1 text-xs text-zinc-400">Active goals by readiness band</p>
      <div className="mt-4 space-y-3">
        {bands.map((b, i) => (
          <div key={b.band}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-zinc-600">
                {b.label} <span className="text-zinc-400">({b.band}%)</span>
              </span>
              <span className="font-semibold text-zinc-900">{b.count}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full rounded-full ${colors[i]}`}
                style={{ width: `${(b.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Action throughput ───────────────────────────────────────────

function ActionThroughputCard({ data }: { data: ActionThroughputData }) {
  const segments = [
    { label: "Done", count: data.done, bar: "bg-emerald-500" },
    { label: "In progress", count: data.inProgress, bar: "bg-sky-500" },
    { label: "To do", count: data.todo, bar: "bg-zinc-300" },
    { label: "Skipped", count: data.skipped, bar: "bg-zinc-200" },
  ];
  const total = Math.max(1, segments.reduce((s, seg) => s + seg.count, 0));
  return (
    <Card className="h-full">
      <div className="flex items-baseline justify-between">
        <CardTitle>Action throughput</CardTitle>
        <span className="text-xs text-zinc-400">{data.completionRate}% done</span>
      </div>
      <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-zinc-100">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={seg.bar}
            style={{ width: `${(seg.count / total) * 100}%` }}
            title={`${seg.label}: ${seg.count}`}
          />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-zinc-600">
              <span className={`h-2.5 w-2.5 rounded-full ${seg.bar}`} />
              {seg.label}
            </span>
            <span className="font-semibold text-zinc-900">{seg.count}</span>
          </div>
        ))}
      </div>
      {data.overdue > 0 && (
        <p className="mt-3 border-t border-zinc-100 pt-3 text-sm text-red-600">
          {data.overdue} open action{data.overdue === 1 ? "" : "s"} overdue
        </p>
      )}
    </Card>
  );
}

// ─── Value balance ───────────────────────────────────────────────

function ValueBalance({ items }: { items: ValueBalanceItem[] }) {
  return (
    <Card className="h-full">
      <CardTitle>Value balance</CardTitle>
      <p className="mt-1 text-xs text-zinc-400">
        Goal activity and readiness across your values
      </p>
      <div className="mt-4 space-y-3">
        {items.map((v) => (
          <div key={v.valueId ?? v.label} className="flex items-center gap-3">
            <span className="w-40 shrink-0 truncate text-sm text-zinc-700" title={v.label}>
              {v.label}
            </span>
            <div className="flex-1">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={`h-full rounded-full ${
                    v.activeGoalCount === 0 ? "bg-zinc-300" : "bg-indigo-500"
                  }`}
                  style={{ width: `${v.avgReadiness}%` }}
                />
              </div>
            </div>
            <span className="w-28 shrink-0 text-right text-xs text-zinc-500">
              {v.activeGoalCount} active · {v.completedGoalCount} done
            </span>
            <span className="w-10 shrink-0 text-right text-sm font-semibold text-zinc-900">
              {v.activeGoalCount === 0 ? "—" : `${v.avgReadiness}%`}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Needs attention ─────────────────────────────────────────────

function NeedsAttention({ data }: { data: NeedsAttentionData }) {
  const empty =
    data.staleGoals.length === 0 && data.staleStakeholders.length === 0;
  return (
    <Card className="h-full">
      <CardTitle>Needs attention</CardTitle>
      {empty ? (
        <p className="mt-4 text-sm text-zinc-500">
          Nothing stale right now — great job staying on top of things.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {data.staleGoals.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Stale goals
              </p>
              <ul className="space-y-2">
                {data.staleGoals.map((g) => (
                  <li key={g.id} className="flex items-start justify-between gap-2 text-sm">
                    <span className="truncate text-zinc-700" title={g.title}>
                      {g.title}
                    </span>
                    <span className="shrink-0 text-xs text-amber-600">{g.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.staleStakeholders.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Reconnect with
              </p>
              <ul className="space-y-2">
                {data.staleStakeholders.map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-2 text-sm">
                    <span className="truncate text-zinc-700" title={s.title}>
                      {s.title}
                    </span>
                    <span className="shrink-0 text-xs text-zinc-500">{s.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
