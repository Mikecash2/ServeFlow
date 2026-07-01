import { Injectable } from "@nestjs/common";
import { CandidatesRepository } from "./candidates.repository";
import { CandidateRow, CandidateScore, SCORING_WEIGHTS } from "./scheduling.types";

@Injectable()
export class ScoringService {
  constructor(private readonly candidates: CandidatesRepository) {}

  /**
   * Computes the weighted soft-constraint score for every candidate against
   * one ServiceRole (docs/04-ai-scheduling-algorithm.md §3). Workload
   * balancing is normalized *within this candidate set* (relative to the
   * busiest candidate for this role), not against a global ministry
   * average — simpler to reason about and just as effective at pulling
   * under-used volunteers up relative to their actual competition for this
   * slot.
   */
  async scoreCandidates(params: {
    churchId: string;
    serviceRoleId: string;
    roleName: string;
    serviceDate: string;
    candidates: CandidateRow[];
  }): Promise<CandidateScore[]> {
    const { churchId, serviceRoleId, roleName, serviceDate, candidates } = params;

    const trailing8WeekCounts = await Promise.all(
      candidates.map((c) =>
        this.candidates.getTrailingAssignmentCount(churchId, c.volunteerProfileId, serviceDate, 56),
      ),
    );
    const trailing7DayCounts = await Promise.all(
      candidates.map((c) =>
        this.candidates.getTrailingAssignmentCount(churchId, c.volunteerProfileId, serviceDate, 7),
      ),
    );
    const skillMatches = await Promise.all(
      candidates.map((c) => this.candidates.getSkillMatch(churchId, c.volunteerProfileId, serviceRoleId)),
    );

    const maxTrailingCount = Math.max(1, ...trailing8WeekCounts);

    return candidates.map((c, i) => {
      const skillMatch = skillMatches[i];
      const reliability = Math.max(0, Math.min(1, c.reliabilityScore));
      const preferenceMatch = c.preferredRoleNames.includes(roleName) ? 1.0 : 0.5;
      const workloadBalance = 1 - trailing8WeekCounts[i] / maxTrailingCount;
      const fatigueInverse = trailing7DayCounts[i] > 0 ? 0.3 : 1.0;

      const finalScore =
        SCORING_WEIGHTS.skillMatch * skillMatch +
        SCORING_WEIGHTS.reliability * reliability +
        SCORING_WEIGHTS.preferenceMatch * preferenceMatch +
        SCORING_WEIGHTS.workloadBalance * workloadBalance +
        SCORING_WEIGHTS.fatigueInverse * fatigueInverse;

      return {
        volunteerProfileId: c.volunteerProfileId,
        firstName: c.firstName,
        lastName: c.lastName,
        factors: { skillMatch, reliability, preferenceMatch, workloadBalance, fatigueInverse },
        finalScore,
      };
    });
  }
}
