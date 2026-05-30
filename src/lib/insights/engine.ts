import { prisma } from "@/lib/prisma";
import type {
  InsightsOutput,
  HeadlineStats,
  StatusDistributionItem,
  CompletionTrendPoint,
  ReadinessBand,
  ValueBalanceItem,
  ActionThroughput,
  NeedsAttention,
  AttentionItem,
  Momentum,
} from "./types";

const DAY_MS = 1000 * 60 * 60 * 24;

interface PrereqLite {
  status: string;
  confidenceScore: number;
}

// Readiness score for a goal, matching the reasoning engine's formula:
// 60% prerequisite completion ratio + 40% average confidence. Goals with no
// prerequisites default to 50 (unknown readiness).
function goalReadiness(prereqs: PrereqLite[]): number {
  if (prereqs.length === 0) return 50;
  const completed = prereqs.filter((p) => p.status === "COMPLETED").length;
  const completionRatio = completed / prereqs.length;
  const avgConfidence =
    prereqs.reduce((sum, p) => sum + p.confidenceScore, 0) / prereqs.length;
  return Math.round(completionRatio * 60 + (avgConfidence / 100) * 40);
}

const ACTIVE_LIKE = new Set(["ACTIVE", "BLOCKED", "WAITING"]);
const STALE_GOAL_DAYS = 21;
const STALE_STAKEHOLDER_DAYS = 45;

export async function generateInsights(): Promise<InsightsOutput> {
  const now = new Date();

  const [goals, stakeholders, actions, latestGoalEvents] = await Promise.all([
    prisma.goal.findMany({
      include: {
        prerequisites: { select: { status: true, confidenceScore: true } },
        value: { select: { id: true, label: true, rank: true } },
      },
    }),
    prisma.stakeholder.findMany(),
    prisma.action.findMany({ select: { status: true, dueDate: true } }),
    prisma.event.groupBy({
      by: ["entityId"],
      where: { entityType: "GOAL" },
      _max: { occurredAt: true },
    }),
  ]);

  const readinessByGoal = new Map<string, number>();
  for (const g of goals) {
    readinessByGoal.set(g.id, goalReadiness(g.prerequisites));
  }

  const headline = computeHeadline(goals, actions, readinessByGoal, now);
  const statusDistribution = computeStatusDistribution(goals);
  const completionTrend = computeCompletionTrend(goals, now);
  const readinessDistribution = computeReadinessDistribution(
    goals,
    readinessByGoal
  );
  const valueBalance = computeValueBalance(goals, readinessByGoal);
  const actionThroughput = computeActionThroughput(actions, now);
  const needsAttention = computeNeedsAttention(
    goals,
    stakeholders,
    latestGoalEvents,
    now
  );
  const momentum = computeMomentum(
    goals,
    actionThroughput,
    latestGoalEvents,
    now
  );

  return {
    headline,
    statusDistribution,
    completionTrend,
    readinessDistribution,
    valueBalance,
    actionThroughput,
    needsAttention,
    momentum,
    generatedAt: now.toISOString(),
  };
}

type GoalRow = {
  id: string;
  title: string;
  status: string;
  completedAt: Date | null;
  prerequisites: PrereqLite[];
  value: { id: string; label: string; rank: number } | null;
};

type ActionRow = { status: string; dueDate: Date | null };

function startOfWeek(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function computeHeadline(
  goals: GoalRow[],
  actions: ActionRow[],
  readinessByGoal: Map<string, number>,
  now: Date
): HeadlineStats {
  const activeGoals = goals.filter((g) => g.status === "ACTIVE");
  const blockedGoals = goals.filter((g) => g.status === "BLOCKED");
  const completedGoals = goals.filter((g) => g.status === "COMPLETED");

  const activeReadiness = activeGoals.map((g) => readinessByGoal.get(g.id) ?? 0);
  const avgReadiness =
    activeReadiness.length > 0
      ? Math.round(
          activeReadiness.reduce((a, b) => a + b, 0) / activeReadiness.length
        )
      : 0;

  const openActions = actions.filter(
    (a) => a.status === "TODO" || a.status === "IN_PROGRESS"
  );
  const overdueActions = openActions.filter(
    (a) => a.dueDate !== null && a.dueDate < now
  );

  const weekStart = startOfWeek(now);
  const completedThisWeek = completedGoals.filter(
    (g) => g.completedAt !== null && g.completedAt >= weekStart
  ).length;

  return {
    totalGoals: goals.length,
    activeGoals: activeGoals.length,
    blockedGoals: blockedGoals.length,
    completedGoals: completedGoals.length,
    avgReadiness,
    openActions: openActions.length,
    overdueActions: overdueActions.length,
    completedThisWeek,
  };
}

const STATUS_ORDER = [
  "ACTIVE",
  "BLOCKED",
  "WAITING",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
  "ABANDONED",
];

function computeStatusDistribution(goals: GoalRow[]): StatusDistributionItem[] {
  const counts = new Map<string, number>();
  for (const g of goals) {
    counts.set(g.status, (counts.get(g.status) ?? 0) + 1);
  }
  return STATUS_ORDER.filter((s) => counts.has(s)).map((status) => ({
    status,
    count: counts.get(status) ?? 0,
  }));
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function computeCompletionTrend(
  goals: GoalRow[],
  now: Date
): CompletionTrendPoint[] {
  const points: CompletionTrendPoint[] = [];
  const buckets = new Map<string, number>();

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    buckets.set(key, 0);
    points.push({
      monthStart: d.toISOString(),
      label: MONTH_LABELS[d.getMonth()],
      completed: 0,
    });
  }

  for (const g of goals) {
    if (g.status !== "COMPLETED" || g.completedAt === null) continue;
    const c = g.completedAt;
    const key = `${c.getFullYear()}-${c.getMonth()}`;
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }

  for (const p of points) {
    const d = new Date(p.monthStart);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    p.completed = buckets.get(key) ?? 0;
  }

  return points;
}

const READINESS_BANDS: { band: string; label: string; min: number; max: number }[] =
  [
    { band: "0-25", label: "Just started", min: 0, max: 25 },
    { band: "26-50", label: "Early progress", min: 26, max: 50 },
    { band: "51-75", label: "Well underway", min: 51, max: 75 },
    { band: "76-100", label: "Nearly ready", min: 76, max: 100 },
  ];

function computeReadinessDistribution(
  goals: GoalRow[],
  readinessByGoal: Map<string, number>
): ReadinessBand[] {
  const active = goals.filter((g) => g.status === "ACTIVE");
  return READINESS_BANDS.map((b) => ({
    band: b.band,
    label: b.label,
    count: active.filter((g) => {
      const r = readinessByGoal.get(g.id) ?? 0;
      return r >= b.min && r <= b.max;
    }).length,
  }));
}

function computeValueBalance(
  goals: GoalRow[],
  readinessByGoal: Map<string, number>
): ValueBalanceItem[] {
  const byValue = new Map<
    string,
    {
      valueId: string | null;
      label: string;
      rank: number;
      active: GoalRow[];
      completed: number;
    }
  >();

  for (const g of goals) {
    const key = g.value?.id ?? "__none__";
    if (!byValue.has(key)) {
      byValue.set(key, {
        valueId: g.value?.id ?? null,
        label: g.value?.label ?? "Unassigned",
        rank: g.value?.rank ?? 999,
        active: [],
        completed: 0,
      });
    }
    const entry = byValue.get(key)!;
    if (g.status === "ACTIVE") entry.active.push(g);
    if (g.status === "COMPLETED") entry.completed += 1;
  }

  return Array.from(byValue.values())
    .map((entry) => {
      const readinessVals = entry.active.map(
        (g) => readinessByGoal.get(g.id) ?? 0
      );
      const avgReadiness =
        readinessVals.length > 0
          ? Math.round(
              readinessVals.reduce((a, b) => a + b, 0) / readinessVals.length
            )
          : 0;
      return {
        valueId: entry.valueId,
        label: entry.label,
        rank: entry.rank,
        activeGoalCount: entry.active.length,
        completedGoalCount: entry.completed,
        avgReadiness,
      };
    })
    .sort((a, b) => a.rank - b.rank);
}

function computeActionThroughput(
  actions: ActionRow[],
  now: Date
): ActionThroughput {
  let todo = 0;
  let inProgress = 0;
  let done = 0;
  let skipped = 0;
  let overdue = 0;
  for (const a of actions) {
    switch (a.status) {
      case "TODO":
        todo += 1;
        break;
      case "IN_PROGRESS":
        inProgress += 1;
        break;
      case "DONE":
        done += 1;
        break;
      case "SKIPPED":
        skipped += 1;
        break;
    }
    if (
      (a.status === "TODO" || a.status === "IN_PROGRESS") &&
      a.dueDate !== null &&
      a.dueDate < now
    ) {
      overdue += 1;
    }
  }
  const open = todo + inProgress;
  const completionRate =
    done + open > 0 ? Math.round((done / (done + open)) * 100) : 0;
  return { todo, inProgress, done, skipped, overdue, completionRate };
}

function daysBetween(now: Date, then: Date): number {
  return Math.floor((now.getTime() - then.getTime()) / DAY_MS);
}

function computeNeedsAttention(
  goals: GoalRow[],
  stakeholders: { id: string; name: string; lastInteraction: Date | null }[],
  latestGoalEvents: { entityId: string; _max: { occurredAt: Date | null } }[],
  now: Date
): NeedsAttention {
  const lastActivityByGoal = new Map<string, Date | null>();
  for (const e of latestGoalEvents) {
    lastActivityByGoal.set(e.entityId, e._max.occurredAt);
  }

  const staleGoals: AttentionItem[] = [];
  for (const g of goals) {
    if (!ACTIVE_LIKE.has(g.status)) continue;
    const last = lastActivityByGoal.get(g.id) ?? null;
    const daysStale = last !== null ? daysBetween(now, last) : 999;
    if (daysStale >= STALE_GOAL_DAYS) {
      staleGoals.push({
        id: g.id,
        title: g.title,
        detail:
          last !== null
            ? `No activity in ${daysStale} days`
            : "No recorded activity yet",
        daysStale,
      });
    }
  }
  staleGoals.sort((a, b) => b.daysStale - a.daysStale);

  const staleStakeholders: AttentionItem[] = [];
  for (const s of stakeholders) {
    const daysStale =
      s.lastInteraction !== null ? daysBetween(now, s.lastInteraction) : 999;
    if (daysStale >= STALE_STAKEHOLDER_DAYS) {
      staleStakeholders.push({
        id: s.id,
        title: s.name,
        detail:
          s.lastInteraction !== null
            ? `Last contact ${daysStale} days ago`
            : "Never contacted",
        daysStale,
      });
    }
  }
  staleStakeholders.sort((a, b) => b.daysStale - a.daysStale);

  return {
    staleGoals: staleGoals.slice(0, 6),
    staleStakeholders: staleStakeholders.slice(0, 6),
  };
}

function computeMomentum(
  goals: GoalRow[],
  throughput: ActionThroughput,
  latestGoalEvents: { entityId: string; _max: { occurredAt: Date | null } }[],
  now: Date
): Momentum {
  // Completions in the last 60 days.
  const sixtyDaysAgo = new Date(now.getTime() - 60 * DAY_MS);
  const recentCompletions = goals.filter(
    (g) =>
      g.status === "COMPLETED" &&
      g.completedAt !== null &&
      g.completedAt >= sixtyDaysAgo
  ).length;

  // Fraction of active goals touched in the last 14 days.
  const fourteenDaysAgo = new Date(now.getTime() - 14 * DAY_MS);
  const lastActivityByGoal = new Map<string, Date | null>();
  for (const e of latestGoalEvents) {
    lastActivityByGoal.set(e.entityId, e._max.occurredAt);
  }
  const activeGoals = goals.filter((g) => g.status === "ACTIVE");
  const freshActive = activeGoals.filter((g) => {
    const last = lastActivityByGoal.get(g.id);
    return last != null && last >= fourteenDaysAgo;
  }).length;
  const freshnessRatio =
    activeGoals.length > 0 ? freshActive / activeGoals.length : 0;

  const completionScore = Math.min(recentCompletions, 6) / 6;
  const throughputScore = throughput.completionRate / 100;
  const freshnessScore = freshnessRatio;

  const score = Math.round(
    (completionScore * 0.4 + throughputScore * 0.3 + freshnessScore * 0.3) * 100
  );

  let label: string;
  if (score >= 70) label = "Strong";
  else if (score >= 45) label = "Steady";
  else if (score >= 25) label = "Slowing";
  else label = "Stalled";

  return {
    score,
    label,
    components: [
      { label: "Goals completed (60d)", value: `${recentCompletions}` },
      { label: "Action completion rate", value: `${throughput.completionRate}%` },
      {
        label: "Active goals worked this week",
        value: `${freshActive}/${activeGoals.length}`,
      },
    ],
  };
}
