"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";
import { StatusBadge, PriorityBadge } from "@/components/ui/StatusBadge";

interface Evidence {
  id: string;
  title: string;
  description: string | null;
  source: string | null;
}

interface Prerequisite {
  id: string;
  title: string;
  status: string;
  confidenceScore: number;
  evidence: Evidence[];
}

interface Action {
  id: string;
  title: string;
  status: string;
  priority: string;
}

interface Relationship {
  id: string;
  label: string | null;
  stakeholderFromId: string | null;
  stakeholderToId: string | null;
}

interface Goal {
  id: string;
  title: string;
  description: string | null;
  successCriteria: string | null;
  status: string;
  targetDate: string | null;
  completedAt: string | null;
  updatedAt: string;
  prerequisites: Prerequisite[];
  actions: Action[];
  relationshipsFrom: Relationship[];
  relationshipsTo: Relationship[];
}

interface GoalEvent {
  id: string;
  eventType: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

interface StakeholderLite {
  id: string;
  name: string;
  organization: string | null;
  role: string | null;
}

const STATUSES = ["ACTIVE", "PAUSED", "COMPLETED"] as const;

function summarizeEvent(e: GoalEvent): string {
  const p = e.payload || {};
  if (typeof p.title === "string") return p.title;
  if (typeof p.note === "string") return p.note;
  if (typeof p.to === "string" && typeof p.from === "string") return `${p.from} → ${p.to}`;
  if (p.statusChanged && typeof p.statusChanged === "object") {
    const sc = p.statusChanged as { from?: string; to?: string };
    return `${sc.from} → ${sc.to}`;
  }
  return "";
}

export function GoalDetail({ id }: { id: string }) {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [events, setEvents] = useState<GoalEvent[]>([]);
  const [stakeholders, setStakeholders] = useState<StakeholderLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [goalRes, eventsRes, stakeRes] = await Promise.all([
          fetch(`/api/goals/${id}`),
          fetch(`/api/goals/${id}/events`),
          fetch(`/api/stakeholders`),
        ]);
        const goalData = goalRes.ok ? await goalRes.json() : null;
        const eventsData = eventsRes.ok ? await eventsRes.json() : [];
        const stakeData = stakeRes.ok ? await stakeRes.json() : [];
        if (!cancelled) {
          setGoal(goalData && !goalData.error ? goalData : null);
          setEvents(Array.isArray(eventsData) ? eventsData : []);
          setStakeholders(Array.isArray(stakeData) ? stakeData : []);
        }
      } catch {
        if (!cancelled) setGoal(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(`/api/goals/${id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.error("Goal progress error:", err);
    }
    setBusy(false);
    setLoading(true);
    setReloadKey((k) => k + 1);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-800" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <h1 className="text-lg font-semibold text-zinc-700">Goal not found</h1>
        <Link href="/" className="mt-2 inline-block text-sm text-pink-600 hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const totalItems = goal.prerequisites.length + goal.actions.length;
  const doneItems =
    goal.prerequisites.filter((p) => p.status === "COMPLETED").length +
    goal.actions.filter((a) => a.status === "DONE").length;
  const progress = totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 100);

  const stakeholderIds = new Set<string>();
  for (const r of [...goal.relationshipsFrom, ...goal.relationshipsTo]) {
    if (r.stakeholderFromId) stakeholderIds.add(r.stakeholderFromId);
    if (r.stakeholderToId) stakeholderIds.add(r.stakeholderToId);
  }
  const linkedStakeholders = stakeholders.filter((s) => stakeholderIds.has(s.id));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800">
        ← Dashboard
      </Link>

      <div className="mt-3 mb-5">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-zinc-900">{goal.title}</h1>
          <StatusBadge status={goal.status} />
        </div>
        {goal.targetDate && (
          <p className="mt-1 text-sm text-zinc-500">
            Target {new Date(goal.targetDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        )}
        {goal.description && <p className="mt-3 text-sm text-zinc-700">{goal.description}</p>}
        {goal.successCriteria && (
          <div className="mt-3 rounded-lg bg-zinc-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Success criteria</p>
            <p className="mt-1 text-sm text-zinc-700">{goal.successCriteria}</p>
          </div>
        )}
      </div>

      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <CardTitle>Progress</CardTitle>
          <span className="text-sm font-semibold text-zinc-900">{progress}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-zinc-500">
          {`${doneItems} of ${totalItems} prerequisites & actions complete`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => post({ action: "change_status", status: s })}
              disabled={busy || goal.status === s}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                goal.status === s
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <CardTitle className="mb-3">
          Prerequisites ({goal.prerequisites.filter((p) => p.status === "COMPLETED").length}/{goal.prerequisites.length})
        </CardTitle>
        {goal.prerequisites.length === 0 ? (
          <p className="text-sm text-zinc-400">No prerequisites.</p>
        ) : (
          <ul className="space-y-3">
            {goal.prerequisites.map((p) => (
              <li key={p.id}>
                <div className="flex items-center gap-2">
                  <StatusBadge status={p.status} />
                  <span className="text-sm text-zinc-800">{p.title}</span>
                  <span className="ml-auto text-xs tabular-nums text-zinc-400">{p.confidenceScore}%</span>
                </div>
                {p.evidence.length > 0 && (
                  <ul className="mt-1.5 space-y-1 pl-4">
                    {p.evidence.map((ev) => (
                      <li key={ev.id} className="text-xs text-zinc-500">
                        ✓ {ev.title}
                        {ev.source && <span className="text-zinc-400"> · {ev.source}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-4">
        <CardTitle className="mb-3">
          Actions ({goal.actions.filter((a) => a.status === "DONE").length}/{goal.actions.length})
        </CardTitle>
        {goal.actions.length === 0 ? (
          <p className="text-sm text-zinc-400">No actions.</p>
        ) : (
          <ul className="space-y-2">
            {goal.actions.map((a) => {
              const done = a.status === "DONE" || a.status === "SKIPPED";
              return (
                <li key={a.id} className="flex items-center gap-2">
                  <button
                    onClick={() => post({ action: "complete_action", actionId: a.id })}
                    disabled={busy || done}
                    title={done ? "Completed" : "Mark complete"}
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${
                      done
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-zinc-300 hover:border-emerald-500"
                    } disabled:cursor-not-allowed`}
                  >
                    {done && (
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <PriorityBadge priority={a.priority} />
                  <span className={`text-sm ${done ? "text-zinc-400 line-through" : "text-zinc-800"}`}>
                    {a.title}
                  </span>
                  <span className="ml-auto">
                    <StatusBadge status={a.status} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {linkedStakeholders.length > 0 && (
        <Card className="mb-4">
          <CardTitle className="mb-3">Linked stakeholders</CardTitle>
          <div className="flex flex-wrap gap-2">
            {linkedStakeholders.map((s) => (
              <Link
                key={s.id}
                href="/relationships"
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
              >
                {s.name}
                {(s.role || s.organization) && (
                  <span className="text-zinc-400"> · {[s.role, s.organization].filter(Boolean).join(", ")}</span>
                )}
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardTitle className="mb-3">Activity</CardTitle>
        {events.length === 0 ? (
          <p className="text-sm text-zinc-400">No activity recorded yet.</p>
        ) : (
          <ol className="space-y-3">
            {events.map((e) => {
              const summary = summarizeEvent(e);
              return (
                <li key={e.id} className="border-l-2 border-zinc-200 pl-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-800">
                      {e.eventType.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                    </span>
                    <span className="ml-auto text-xs text-zinc-400">
                      {new Date(e.occurredAt).toLocaleDateString()}
                    </span>
                  </div>
                  {summary && <p className="mt-0.5 text-sm text-zinc-600">{summary}</p>}
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </div>
  );
}
