import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { SchedulingService } from "./scheduling.service";
import { ScheduleRunsRepository } from "./schedule-runs.repository";
import { VolunteersRepository } from "../volunteers/volunteers.repository";
import { ServicesRepository } from "../services/services.repository";
import { AuthenticatedUser } from "../auth/auth.types";
import { overrideAssignmentSchema, OverrideAssignmentDto } from "./dto/override-assignment.dto";

@Controller("churches/:churchId")
@UseGuards(PermissionGuard)
export class SchedulingController {
  constructor(
    private readonly scheduling: SchedulingService,
    private readonly scheduleRuns: ScheduleRunsRepository,
    private readonly volunteers: VolunteersRepository,
    private readonly services: ServicesRepository,
  ) {}

  @Post("services/:serviceId/schedule-runs")
  @RequirePermission({ resource: "service", action: "write" })
  async generate(
    @Param("churchId") churchId: string,
    @Param("serviceId") serviceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const service = await this.services.findById(churchId, serviceId);
    if (!service) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Service not found" } });
    }
    return this.scheduling.generateSchedule(churchId, serviceId, user.id);
  }

  @Get("services/:serviceId/schedule-runs/:runId")
  @RequirePermission({ resource: "service", action: "read" })
  async getRun(@Param("churchId") churchId: string, @Param("serviceId") serviceId: string, @Param("runId") runId: string) {
    const run = await this.scheduleRuns.findRunById(churchId, serviceId, runId);
    if (!run) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Schedule run not found" } });
    }
    return run;
  }

  @Get("services/:serviceId/schedule-runs/:runId/assignments")
  @RequirePermission({ resource: "service", action: "read" })
  async getAssignments(
    @Param("churchId") churchId: string,
    @Param("serviceId") serviceId: string,
    @Param("runId") runId: string,
  ) {
    const run = await this.scheduleRuns.findRunById(churchId, serviceId, runId);
    if (!run) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Schedule run not found" } });
    }
    return this.scheduleRuns.listAssignmentsForRun(churchId, runId);
  }

  @Get("assignments/:assignmentId/explain")
  @RequirePermission({ resource: "service", action: "read" })
  async explain(@Param("churchId") churchId: string, @Param("assignmentId") assignmentId: string) {
    const assignment = await this.scheduleRuns.findAssignmentById(churchId, assignmentId);
    if (!assignment) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Assignment not found" } });
    }
    const volunteer = await this.volunteers.findById(churchId, assignment.volunteerProfileId);
    const sentence = this.scheduling.explain(assignment.reasoning, volunteer?.firstName ?? "This volunteer");
    return { assignment, explanation: sentence };
  }

  @Post("assignments/:assignmentId/confirm")
  @RequirePermission({ resource: "service", action: "read" })
  async confirm(@Param("churchId") churchId: string, @Param("assignmentId") assignmentId: string) {
    const assignment = await this.scheduleRuns.findAssignmentById(churchId, assignmentId);
    if (!assignment) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Assignment not found" } });
    }
    const confirmed = await this.scheduleRuns.confirmAssignment(churchId, assignmentId);
    return confirmed;
  }

  @Post("assignments/:assignmentId/decline")
  @RequirePermission({ resource: "service", action: "read" })
  async decline(@Param("churchId") churchId: string, @Param("assignmentId") assignmentId: string) {
    const assignment = await this.scheduleRuns.findAssignmentById(churchId, assignmentId);
    if (!assignment) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Assignment not found" } });
    }
    const replacement = await this.scheduling.handleDecline(churchId, assignmentId);
    return { declined: true, replacement };
  }

  @Post("assignments/:assignmentId/override")
  @RequirePermission({ resource: "service", action: "write" })
  async override(
    @Param("churchId") churchId: string,
    @Param("assignmentId") assignmentId: string,
    @Body(new ZodValidationPipe(overrideAssignmentSchema)) dto: OverrideAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const assignment = await this.scheduleRuns.findAssignmentById(churchId, assignmentId);
    if (!assignment) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Assignment not found" } });
    }
    const volunteer = await this.volunteers.findById(churchId, dto.volunteerProfileId);
    if (!volunteer) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Target volunteer not found" } });
    }
    return this.scheduleRuns.overrideAssignment(churchId, assignmentId, dto.volunteerProfileId, {
      candidatesConsidered: assignment.reasoning.candidatesConsidered,
      hardConstraintsPassed: [],
      factorBreakdown: assignment.reasoning.factorBreakdown,
      finalScore: 0,
      runnerUp: null,
    });
  }
}
