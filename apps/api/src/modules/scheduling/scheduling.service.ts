import { Injectable } from "@nestjs/common";
import { CandidatesRepository } from "./candidates.repository";
import { ScoringService } from "./scoring.service";
import { ScheduleRunsRepository, AssignmentRecord } from "./schedule-runs.repository";
import { ServiceRolesRepository } from "../service-roles/service-roles.repository";
import { ServicesRepository } from "../services/services.repository";
import { AssignmentReasoning } from "./scheduling.types";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { ProductAnalyticsService } from "../observability/product-analytics.service";
import { NotificationsService } from "../notifications/notifications.service";
import { VolunteersRepository } from "../volunteers/volunteers.repository";

export interface GenerateScheduleResult {
  runId: string;
  coveragePct: number;
  summary: string;
  assignments: AssignmentRecord[];
}

@Injectable()
export class SchedulingService {
  constructor(
    private readonly candidates: CandidatesRepository,
    private readonly scoring: ScoringService,
    private readonly scheduleRuns: ScheduleRunsRepository,
    private readonly serviceRoles: ServiceRolesRepository,
    private readonly services: ServicesRepository,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
    private readonly volunteers: VolunteersRepository,
    private readonly analytics: ProductAnalyticsService,
  ) {}

  /**
   * Runs the solve procedure from docs/04-ai-scheduling-algorithm.md §5 for
   * every ServiceRole on a service: resolve hard-constraint-eligible
   * candidates, score them, and greedily fill the role from highest score
   * down, up to maxAllowed, stopping once minRequired is unfillable.
   *
   * This is a greedy per-role fill, not a true weighted bipartite matching
   * solve — a genuinely optimal solve could occasionally do better overall
   * by NOT giving a role its single best candidate if that candidate is an
   * even-better fit for a role considered later. Documented as a Phase 4
   * simplification: at the scale this runs at (5-15 roles, tens of
   * candidates per service — see docs/04-ai-scheduling-algorithm.md §9),
   * greedy-by-role produces very similar coverage to true optimal matching,
   * and is far easier to explain to a leader ("we filled roles in the order
   * you added them, best candidate first") than a global optimization
   * would be. Revisit if real usage shows meaningfully worse rosters.
   *
   * Runs synchronously in-request rather than as a BullMQ job streamed over
   * WebSocket (per docs/02-architecture.md §6) — this sandbox has no Redis
   * available (no Docker, no root to install a system package), and at this
   * scale the whole solve completes in well under a second anyway. Swapping
   * to a queued job + WebSocket progress is additive, not a rework: this
   * method's signature doesn't change, only what calls it.
   */
  async generateSchedule(churchId: string, serviceId: string, triggeredById: string): Promise<GenerateScheduleResult> {
    const service = await this.services.findById(churchId, serviceId);
    if (!service) throw new Error("Service not found");

    const roles = await this.serviceRoles.listForService(churchId, serviceId);
    const run = await this.scheduleRuns.createRun(churchId, serviceId, triggeredById);

    const assignments: AssignmentRecord[] = [];
    const takenThisRun: string[] = [];
    let totalRequired = 0;
    let totalFilled = 0;
    const gaps: string[] = [];

    for (const role of roles) {
      totalRequired += role.minRequired;
      const candidates = await this.candidates.resolveCandidates(churchId, role.id, takenThisRun);

      if (candidates.length === 0) {
        if (role.minRequired > 0) gaps.push(role.name);
        continue;
      }

      const scored = await this.scoring.scoreCandidates({
        churchId,
        serviceRoleId: role.id,
        roleName: role.name,
        serviceDate: service.date,
        candidates,
      });
      scored.sort((a, b) => b.finalScore - a.finalScore);

      const slotsToFill = Math.min(role.maxAllowed, scored.length);
      const filledForThisRole = Math.min(slotsToFill, Math.max(role.minRequired, slotsToFill > 0 ? 1 : 0));

      for (let i = 0; i < filledForThisRole; i++) {
        const winner = scored[i];
        const runnerUp = scored[i + 1] ?? null;

        const reasoning: AssignmentReasoning = {
          candidatesConsidered: scored.length,
          hardConstraintsPassed: ["active_status", "ministry_membership", "available", "no_double_booking", "required_skills"],
          factorBreakdown: winner.factors,
          finalScore: winner.finalScore,
          runnerUp: runnerUp
            ? {
                volunteerProfileId: runnerUp.volunteerProfileId,
                firstName: runnerUp.firstName,
                lastName: runnerUp.lastName,
                score: runnerUp.finalScore,
              }
            : null,
        };

        const assignment = await this.scheduleRuns.createAssignment({
          churchId,
          scheduleRunId: run.id,
          serviceRoleId: role.id,
          volunteerProfileId: winner.volunteerProfileId,
          source: "AI_GENERATED",
          score: winner.finalScore,
          reasoning,
        });
        assignments.push(assignment);
        takenThisRun.push(winner.volunteerProfileId);
        totalFilled++;
      }

      if (filledForThisRole < role.minRequired) gaps.push(role.name);
    }

    const coveragePct = totalRequired > 0 ? Math.round((totalFilled / totalRequired) * 100) : 100;
    const summary =
      gaps.length === 0
        ? `All ${roles.length} role(s) fully staffed.`
        : `${totalFilled}/${totalRequired} required slots filled. Coverage gap(s): ${gaps.join(", ")}.`;

    await this.scheduleRuns.completeRun(churchId, run.id, coveragePct, summary);
    this.realtime.emitCoverageChanged(churchId, { serviceId, runId: run.id, coveragePct, summary });
    this.analytics.track("schedule_generated", triggeredById, { churchId, serviceId, coveragePct, roleCount: roles.length });

    return { runId: run.id, coveragePct, summary, assignments };
  }

  /** Plain-language version of an Assignment's reasoning (docs/04-ai-scheduling-algorithm.md §6). */
  explain(reasoning: AssignmentReasoning, volunteerFirstName: string): string {
    const f = reasoning.factorBreakdown;
    const parts: string[] = [];
    if (f.skillMatch >= 0.8) parts.push("meets or exceeds the required skill level");
    if (f.reliability >= 0.8) parts.push("has a strong reliability history");
    if (f.preferenceMatch >= 1.0) parts.push("listed this role as a preference");
    if (f.workloadBalance >= 0.7) parts.push("hasn't served much recently, so this helps balance workload");
    if (f.fatigueInverse < 1.0) parts.push("note: they served within the last 7 days, which slightly lowered their score");

    const reasonText = parts.length > 0 ? parts.join("; ") : "was the best-scoring eligible candidate";
    const runnerUpText = reasoning.runnerUp
      ? ` The next-best candidate, ${reasoning.runnerUp.firstName}, scored ${(reasoning.runnerUp.score * 100).toFixed(0)}% vs. ${(reasoning.finalScore * 100).toFixed(0)}%.`
      : "";

    return `${volunteerFirstName} was assigned because they ${reasonText} (score ${(reasoning.finalScore * 100).toFixed(0)}%, out of ${reasoning.candidatesConsidered} eligible candidate(s)).${runnerUpText}`;
  }

  /**
   * docs/03-api-spec.md AI Scheduling section: "a decline triggers automatic
   * re-solve for that role." Bounded, not a full restart (docs/04-ai-scheduling-algorithm.md
   * §5 step 5) — only the vacated role is re-solved, excluding volunteers
   * already placed elsewhere in this run and the volunteer who just declined.
   * Returns the new assignment if a replacement was found, or null if the
   * role is now a coverage gap (visible on the Phase 5 dashboard).
   */
  async handleDecline(churchId: string, assignmentId: string) {
    const declined = await this.scheduleRuns.declineAssignment(churchId, assignmentId);
    if (!declined) return null;

    const role = await this.serviceRoles.findByRoleId(churchId, declined.serviceRoleId);
    if (!role) return null;

    const service = await this.services.findById(churchId, role.serviceId);
    if (!service) return null;

    const existingAssignments = await this.scheduleRuns.listAssignmentsForRun(churchId, declined.scheduleRunId);
    const takenVolunteerIds = existingAssignments
      .filter((a) => a.declinedAt === null && a.id !== declined.id)
      .map((a) => a.volunteerProfileId);
    takenVolunteerIds.push(declined.volunteerProfileId);

    const candidates = await this.candidates.resolveCandidates(churchId, role.id, takenVolunteerIds);
    if (candidates.length === 0) return null;

    const scored = await this.scoring.scoreCandidates({
      churchId,
      serviceRoleId: role.id,
      roleName: role.name,
      serviceDate: service.date,
      candidates,
    });
    scored.sort((a, b) => b.finalScore - a.finalScore);
    const winner = scored[0];

    const reasoning: AssignmentReasoning = {
      candidatesConsidered: scored.length,
      hardConstraintsPassed: ["active_status", "ministry_membership", "available", "no_double_booking", "required_skills"],
      factorBreakdown: winner.factors,
      finalScore: winner.finalScore,
      runnerUp: null,
    };

    const newAssignment = await this.scheduleRuns.createAssignment({
      churchId,
      scheduleRunId: declined.scheduleRunId,
      serviceRoleId: role.id,
      volunteerProfileId: winner.volunteerProfileId,
      source: "AI_GENERATED",
      score: winner.finalScore,
      reasoning,
    });

    const newVolunteer = await this.volunteers.findById(churchId, winner.volunteerProfileId);
    if (newVolunteer) {
      await this.notifications.notifyByEmail({
        churchId,
        userId: newVolunteer.userId,
        title: `You've been assigned: ${role.name}`,
        body: `You're now scheduled for "${service.title}" as ${role.name}, filling in after another volunteer declined.`,
      });
    }

    this.realtime.emitCoverageChanged(churchId, {
      serviceId: role.serviceId,
      scheduleRunId: declined.scheduleRunId,
      reassignedRole: role.name,
    });

    return newAssignment;
  }
}
