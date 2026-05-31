export interface HeadlineStats {
  totalGoals: number;
  activeGoals: number;
  blockedGoals: number;
  completedGoals: number;
  avgReadiness: number; // across active goals, 0-100
  openActions: number;
  overdueActions: number;
  completedThisWeek: number;
}

export interface StatusDistributionItem {
  status: string;
  count: number;
}

export interface CompletionTrendPoint {
  monthStart: string; // ISO date of the first day of the month
  label: string; // e.g. "Jun"
  completed: number;
}

export interface ReadinessBand {
  band: string; // e.g. "0-25"
  label: string;
  count: number;
}

export interface ValueBalanceItem {
  valueId: string | null;
  label: string;
  rank: number;
  activeGoalCount: number;
  completedGoalCount: number;
  avgReadiness: number; // across that value's active goals, 0-100
}

export interface ActionThroughput {
  todo: number;
  inProgress: number;
  done: number;
  skipped: number;
  overdue: number;
  completionRate: number; // done / (done + open), 0-100
}

export interface AttentionItem {
  id: string;
  title: string;
  detail: string;
  daysStale: number;
}

export interface NeedsAttention {
  staleGoals: AttentionItem[];
  staleStakeholders: AttentionItem[];
}

export interface MomentumComponent {
  label: string;
  value: string;
}

export interface Momentum {
  score: number; // 0-100
  label: string;
  components: MomentumComponent[];
}

export interface InsightsOutput {
  headline: HeadlineStats;
  statusDistribution: StatusDistributionItem[];
  completionTrend: CompletionTrendPoint[];
  readinessDistribution: ReadinessBand[];
  valueBalance: ValueBalanceItem[];
  actionThroughput: ActionThroughput;
  needsAttention: NeedsAttention;
  momentum: Momentum;
  generatedAt: string;
}
