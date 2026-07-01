import { Injectable } from "@nestjs/common";
import { TenantDbService } from "../../database/tenant-db.service";

export type TaskPhase = "SETUP" | "SERVICE" | "DERIG";
export type TaskStatusValue = "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED";

export interface TaskRecord {
  id: string;
  serviceId: string;
  phase: TaskPhase;
  title: string;
  description: string | null;
  priority: number;
  estimatedMinutes: number | null;
  status: TaskStatusValue;
  assignedVolunteerId: string | null;
  dependsOnTaskId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  photoUrls: string[];
}

interface TaskRow {
  id: string; service_id: string; phase: TaskPhase; title: string; description: string | null;
  priority: number; estimated_minutes: number | null; status: TaskStatusValue;
  assigned_volunteer_id: string | null; depends_on_task_id: string | null;
  started_at: string | null; completed_at: string | null; photo_urls: string[];
}

function toRecord(row: TaskRow): TaskRecord {
  return {
    id: row.id,
    serviceId: row.service_id,
    phase: row.phase,
    title: row.title,
    description: row.description,
    priority: row.priority,
    estimatedMinutes: row.estimated_minutes,
    status: row.status,
    assignedVolunteerId: row.assigned_volunteer_id,
    dependsOnTaskId: row.depends_on_task_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    photoUrls: row.photo_urls,
  };
}

const FIELDS = `id, service_id, phase, title, description, priority, estimated_minutes,
  status, assigned_volunteer_id, depends_on_task_id, started_at, completed_at, photo_urls`;

@Injectable()
export class TasksRepository {
  constructor(private readonly tenantDb: TenantDbService) {}

  async create(params: {
    churchId: string; serviceId: string; phase: TaskPhase; title: string; description?: string;
    priority?: number; estimatedMinutes?: number; dependsOnTaskId?: string;
  }): Promise<TaskRecord> {
    return this.tenantDb.runInTenantContext(params.churchId, async (query) => {
      const rows = await query<TaskRow>(
        `insert into tasks (service_id, phase, title, description, priority, estimated_minutes, depends_on_task_id)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning ${FIELDS}`,
        [
          params.serviceId, params.phase, params.title, params.description ?? null,
          params.priority ?? 3, params.estimatedMinutes ?? null, params.dependsOnTaskId ?? null,
        ],
      );
      return toRecord(rows[0]);
    });
  }

  async listForService(churchId: string, serviceId: string, phase?: TaskPhase): Promise<TaskRecord[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<TaskRow>(
        `select ${FIELDS} from tasks
         where service_id = $1 and ($2::text is null or phase = $2::task_phase)
         order by priority asc, created_at asc`,
        [serviceId, phase ?? null],
      );
      return rows.map(toRecord);
    });
  }

  async findById(churchId: string, serviceId: string, taskId: string): Promise<TaskRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<TaskRow>(
        `select ${FIELDS} from tasks where id = $1 and service_id = $2`,
        [taskId, serviceId],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }

  async updateStatus(
    churchId: string,
    taskId: string,
    status: TaskStatusValue,
    assignedVolunteerId?: string,
  ): Promise<TaskRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<TaskRow>(
        `update tasks set
           status = $2::task_status,
           assigned_volunteer_id = coalesce($3, assigned_volunteer_id),
           started_at = case when $2::task_status = 'IN_PROGRESS' and started_at is null then now() else started_at end,
           completed_at = case when $2::task_status = 'COMPLETED' then now() else completed_at end
         where id = $1
         returning ${FIELDS}`,
        [taskId, status, assignedVolunteerId ?? null],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }

  async addPhoto(churchId: string, taskId: string, photoUrl: string): Promise<TaskRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<TaskRow>(
        `update tasks set photo_urls = array_append(photo_urls, $2) where id = $1 returning ${FIELDS}`,
        [taskId, photoUrl],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }
}
