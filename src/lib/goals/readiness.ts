interface PrereqLike {
  status: string;
  confidenceScore: number;
}

/**
 * Readiness = 60% prerequisite completion ratio + 40% average confidence.
 * Goals with no prerequisites default to 50 (unknown / neutral).
 */
export function computeReadiness(prereqs: PrereqLike[]): number {
  if (prereqs.length === 0) return 50;
  const completed = prereqs.filter((p) => p.status === "COMPLETED").length;
  const completionRatio = completed / prereqs.length;
  const avgConfidence =
    prereqs.reduce((sum, p) => sum + p.confidenceScore, 0) / prereqs.length;
  return Math.round(completionRatio * 60 + (avgConfidence / 100) * 40);
}
