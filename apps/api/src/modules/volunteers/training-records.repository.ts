import { Injectable } from "@nestjs/common";
import { TenantDbService } from "../../database/tenant-db.service";

export interface TrainingRecordRecord {
  id: string;
  courseName: string;
  completedAt: string | null;
  requiredForRoles: string[];
}

@Injectable()
export class TrainingRecordsRepository {
  constructor(private readonly tenantDb: TenantDbService) {}

  async add(params: {
    churchId: string;
    volunteerProfileId: string;
    courseName: string;
    completedAt?: string;
    requiredForRoles?: string[];
  }): Promise<TrainingRecordRecord> {
    return this.tenantDb.runInTenantContext(params.churchId, async (query) => {
      const rows = await query<{
        id: string; course_name: string; completed_at: string | null; required_for_roles: string[];
      }>(
        `insert into training_records (volunteer_profile_id, course_name, completed_at, required_for_roles)
         values ($1, $2, $3, $4)
         returning id, course_name, completed_at, required_for_roles`,
        [params.volunteerProfileId, params.courseName, params.completedAt ?? null, params.requiredForRoles ?? []],
      );
      const r = rows[0];
      return { id: r.id, courseName: r.course_name, completedAt: r.completed_at, requiredForRoles: r.required_for_roles };
    });
  }

  async listForVolunteer(churchId: string, volunteerProfileId: string): Promise<TrainingRecordRecord[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<{
        id: string; course_name: string; completed_at: string | null; required_for_roles: string[];
      }>(
        `select id, course_name, completed_at, required_for_roles from training_records
         where volunteer_profile_id = $1 order by course_name asc`,
        [volunteerProfileId],
      );
      return rows.map((r) => ({ id: r.id, courseName: r.course_name, completedAt: r.completed_at, requiredForRoles: r.required_for_roles }));
    });
  }
}
