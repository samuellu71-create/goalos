"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ReadinessGauge } from "@/components/ui/ReadinessGauge";

interface GoalData {
  id: string;
  title: string;
  description: string | null;
  status: string;
  targetDate: string | null;
  updatedAt: string;
  completedAt: string | null;
  readiness: number;
  value: { id: string; label: string; rank: number } | null;
  prerequisites: { id: string; status: string }[];
  actions: { id: string; status: string }[];
}

type SortKey = "updated" | "readiness" | "target" | "title";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "updated", label: "Recently updated" },
  { key: "readiness", label: "Readiness (high → low)" },
  { key: "target", label: "Target date (soonest)" },
  { key: "title", label: "Title (A → Z)" },
];

const STATUS_ORDER = [
  "ACTIVE",
  "BLOCKED",
  "WAITING",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
  "ABANDONED",
];

function openActionCount(actions: { status: string }[]): number {
  return actions.filter((a) => a.status !== "DONE" && a.status !== "SKIPPED")
    .length;
}

function formatDate(iso: string | null): string {
  if (!iso) return "No target";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function GoalsBrowser() {
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [valueFilter, setValueFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/goals");
      const data = (await res.json()) as GoalData[];
      if (!cancelled) {
        setGoals(data);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of goals) counts[g.status] = (counts[g.status] ?? 0) + 1;
    return counts;
  }, [goals]);

  const values = useMemo(() => {
    const map = new Map<string, { id: string; label: string; rank: number }>();
    for (const g of goals) if (g.value) map.set(g.value.id, g.value);
    return [...map.values()].sort((a, b) => a.rank - b.rank);
  }, [goals]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = goals.filter((g) => {
      if (statusFilter && g.status !== statusFilter) return false;
      if (valueFilter !== "all") {
        if (valueFilter === "none" ? g.value !== null : g.value?.id !== valueFilter)
          return false;
      }
      if (q) {
        const haystack = `${g.title} ${g.description ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      switch (sortKey) {
        case "readiness":
          return b.readiness - a.readiness;
        case "title":
          return a.title.localeCompare(b.title);
        case "target": {
          const at = a.targetDate ? new Date(a.targetDate).getTime() : Infinity;
          const bt = b.targetDate ? new Date(b.targetDate).getTime() : Infinity;
          return at - bt;
        }
        case "updated":
        default:
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
      }
    });
    return result;
  }, [goals, query, statusFilter, valueFilter, sortKey]);

  const presentStatuses = STATUS_ORDER.filter((s) => statusCounts[s]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-800" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Goals</h1>
          <p className="text-sm text-zinc-500">
            Browse, search, and triage every goal.
          </p>
        </div>
        <p className="text-sm text-zinc-400">
          {filtered.length} of {goals.length}
        </p>
      </div>

      {/* Controls */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search goals…"
            className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
          />
          <select
            value={valueFilter}
            onChange={(e) => setValueFilter(e.target.value)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none"
          >
            <option value="all">All values</option>
            {values.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
            <option value="none">No value</option>
          </select>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                Sort: {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === null
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            All ({goals.length})
          </button>
          {presentStatuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? null : s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {s.replace(/_/g, " ")} ({statusCounts[s]})
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="text-sm text-zinc-500">No goals match your filters.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((g) => {
            const open = openActionCount(g.actions);
            const overdue =
              g.targetDate !== null &&
              g.status !== "COMPLETED" &&
              new Date(g.targetDate).getTime() < now;
            return (
              <Link key={g.id} href={`/goals/${g.id}`} className="block">
                <Card className="flex items-center gap-4 p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50">
                  <ReadinessGauge score={g.readiness} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-zinc-900">
                        {g.title}
                      </h3>
                      <StatusBadge status={g.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                      {g.value && <span>{g.value.label}</span>}
                      <span className={overdue ? "text-red-600" : ""}>
                        {overdue ? "Overdue · " : "Target "}
                        {formatDate(g.targetDate)}
                      </span>
                      <span>
                        {open} open action{open === 1 ? "" : "s"}
                      </span>
                      <span>{g.prerequisites.length} prerequisites</span>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-zinc-700">
                    {g.readiness}%
                  </span>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
