export interface CandidateRow {
  volunteerProfileId: string;
  firstName: string;
  lastName: string;
  reliabilityScore: number;
  preferredRoleNames: string[];
}

export interface FactorBreakdown {
  skillMatch: number;
  reliability: number;
  preferenceMatch: number;
  workloadBalance: number;
  fatigueInverse: number;
}

export interface CandidateScore {
  volunteerProfileId: string;
  firstName: string;
  lastName: string;
  factors: FactorBreakdown;
  finalScore: number;
}

export interface AssignmentReasoning {
  candidatesConsidered: number;
  hardConstraintsPassed: string[];
  factorBreakdown: FactorBreakdown;
  finalScore: number;
  runnerUp: { volunteerProfileId: string; firstName: string; lastName: string; score: number } | null;
}

// Weights sum to 1.0. This is a reduced 5-factor model vs. the 8-factor
// design in docs/04-ai-scheduling-algorithm.md — experienceFit,
// leaderPriorityBoost, and recencyPenalty are deferred because they need
// data this build doesn't track yet (general ministry tenure, a manual
// leader-priority flag, and "did they serve this exact role last time"
// history). See serveflow/README.md for the full list of Phase 4
// simplifications.
export const SCORING_WEIGHTS = {
  skillMatch: 0.3,
  reliability: 0.25,
  preferenceMatch: 0.2,
  workloadBalance: 0.15,
  fatigueInverse: 0.1,
} as const;
