export interface ReliabilityStats {
  volunteerProfileId: string;
  attended: number;
  noShows: number;
  lateCancellations: number;
}

/**
 * docs/04-ai-scheduling-algorithm.md §4: reliabilityScore = attended /
 * (attended + noShows + lateCancellations * 0.5), trailing 12 months, with
 * a Bayesian prior of 0.85 for volunteers with fewer than 5 data points (so
 * one early miss doesn't tank a brand-new volunteer's score), floored/capped
 * to [0.1, 1.0].
 */
export function computeReliabilityScore(stats: Pick<ReliabilityStats, "attended" | "noShows" | "lateCancellations">): number {
  const totalDataPoints = stats.attended + stats.noShows + stats.lateCancellations;
  if (totalDataPoints < 5) return 0.85;

  const denominator = stats.attended + stats.noShows + stats.lateCancellations * 0.5;
  if (denominator <= 0) return 0.85;

  const raw = stats.attended / denominator;
  return Math.max(0.1, Math.min(1.0, raw));
}
