import { Injectable } from "@nestjs/common";
import { TenantDbService } from "../../database/tenant-db.service";
import { AssignmentReasoning } from "./scheduling.types";

export type ScheduleRunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
export type AssignmentSource = "AI_GENERATED" | "MANUAL_OVERRIDE" | "SELF_SIGNUP";

export interface ScheduleRunRecord {
  id: string;
  serviceId: string;
  status: ScheduleRunStatus;
  triggeredById: string;
  startedAt: string;
  completedAt: string | null;
  coveragePct: number | null;
  summary: string | null;
}

export interface AssignmentRecord {
  id: string;
  scheduleRunId: string;
  serviceRoleId: string;
  volunteerProfileId: string;
  source: AssignmentSource;
  score: number;
  reasoning: AssignmentReasoning;
  confirmedAt: string | null;
  declinedAt: string | null;
}

function toRunRecord(row: any): ScheduleRunRecord {
  return {
    id: row.id,
    serviceId: row.service_id,
    status: row.status,
    triggeredById: row.triggered_by_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    coveragePct: row.coverage_pct,
    summary: row.summary,
  };
}

function toAssignmentRecord(row: any): AssignmentRecord {
  return {
    id: row.id,
    scheduleRunId: row.schedule_run_id,
    serviceRoleId: row.service_role_id,
    volunteerProfileId: row.volunteer_profile_id,
    source: row.source,
    score: row.score,
    reasoning: row.reasoning,
    confirmedAt: row.confirmed_at,
    declinedAt: row.declined_at,
  };
}

@Injectable()
export class ScheduleRunsRepository {
  constructor(private readonly tenantDb: TenantDbService) {}

  async createRun(churchId: string, serviceId: string, triggeredById: string): Promise<ScheduleRunRecord> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query(
        `insert into schedule_runs (service_id, status, triggered_by_id)
         values ($1, 'RUNNING', $2)
         returning id, service_id, status, triggered_by_id, started_at, completed_at, coverage_pct, summary`,
        [serviceId, triggeredById],
      );
      return toRunRecord(rows[0]);
    });
  }

  async completeRun(churchId: string, runId: string, coveragePct: number, summary: string): Promise<ScheduleRunRecord> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query(
        `update schedule_runs set status = 'COMPLETED', completed_at = now(), coverage_pct = $2, summary = $3
         where id = $1
         returning id, service_id, status, triggered_by_id, started_at, completed_at, coverage_pct, summary`,
        [runId, coveragePct, summary],
      );
      return toRunRecord(rows[0]);
    });
  }

  async findRunById(churchId: string, serviceId: string, runId: string): Promise<ScheduleRunRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query(
        `select id, service_id, status, triggered_by_id, started_at, completed_at, coverage_pct, summary
         from schedule_runs where id = $1 and service_id = $2`,
        [runId, serviceId],
      );
      return rows[0] ? toRunRecord(rows[0]) : null;
    });
  }

  async createAssignment(params: {
    churchId: string;
    scheduleRunId: string;
    serviceRoleId: string;
    volunteerProfileId: string;
    source: AssignmentSource;
    score: number;
    reasoning: AssignmentReasoning;
  }): Promise<AssignmentRecord> {
    return this.tenantDb.runInTenantContext(params.churchId, async (query) => {
      const rows = await query(
        `insert into assignments (schedule_run_id, service_role_id, volunteer_profile_id, source, score, reasoning)
         values ($1, $2, $3, $4, $5, $6)
         returning id, schedule_run_id, service_role_id, volunteer_profile_id, source, score, reasoning, confirmed_at, declined_at`,
        [
          params.scheduleRunId,
          params.serviceRoleId,
          params.volunteerProfileId,
          params.source,
          params.score,
          JSON.stringify(params.reasoning),
        ],
      );
      return toAssignmentRecord(rows[0]);
    });
  }

  async listAssignmentsForRun(churchId: string, runId: string): Promise<AssignmentRecord[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query(
        `select id, schedule_run_id, service_role_id, volunteer_profile_id, source, score, reasoning, confirmed_at, declined_at
         from assignments where schedule_run_id = $1`,
        [runId],
      );
      return rows.map(toAssignmentRecord);
    });
  }

  async findAssignmentById(churchId: string, assignmentId: string): Promise<AssignmentRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query(`select id, schedule_run_id, service_role_id, volunteer_profile_id, source, score, reasoning, confirmed_at, declined_at from assignments where id = $1`, [
        assignmentId,
      ]);
      return rows[0] ? toAssignmentRecord(rows[0]) : null;
    });
  }

  async overrideAssignment(
    churchId: string,
    assignmentId: string,
    volunteerProfileId: string,
    reasoning: AssignmentReasoning,
  ): Promise<AssignmentRecord> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query(
        `update assignments set volunteer_profile_id = $2, source = 'MANUAL_OVERRIDE', score = 0, reasoning = $3
         where id = $1
         returning id, schedule_run_id, service_role_id, volunteer_profile_id, source, score, reasoning, confirmed_at, declined_at`,
        [assignmentId, volunteerProfileId, JSON.stringify(reasoning)],
      );
      return toAssignmentRecord(rows[0]);
    });
  }
}
