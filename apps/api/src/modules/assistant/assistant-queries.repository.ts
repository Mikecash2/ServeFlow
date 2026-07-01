import { Injectable } from "@nestjs/common";
import { TenantDbService } from "../../database/tenant-db.service";

export interface VolunteerSummary {
  volunteerProfileId: string;
  firstName: string;
  lastName: string;
}

@Injectable()
export class AssistantQueriesRepository {
  constructor(private readonly tenantDb: TenantDbService) {}

  async whoHasntServed(churchId: string, weeks: number): Promise<VolunteerSummary[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<{ id: string; first_name: string; last_name: string }>(
        `select vp.id, u.first_name, u.last_name
         from volunteer_profiles vp
         join users u on u.id = vp.user_id
         where vp.church_id = $1 and vp.status = 'ACTIVE'
           and not exists (
             select 1 from assignments asn
             join schedule_runs run on run.id = asn.schedule_run_id and run.status = 'COMPLETED'
             join services s on s.id = run.service_id
             where asn.volunteer_profile_id = vp.id and asn.declined_at is null
               and s.date >= now() - ($2 || ' weeks')::interval and s.date < now()
           )
         order by u.first_name asc, u.last_name asc`,
        [churchId, weeks],
      );
      return rows.map((r) => ({ volunteerProfileId: r.id, firstName: r.first_name, lastName: r.last_name }));
    });
  }

  async findVolunteerByName(churchId: string, name: string): Promise<VolunteerSummary | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<{ id: string; first_name: string; last_name: string }>(
        `select vp.id, u.first_name, u.last_name
         from volunteer_profiles vp
         join users u on u.id = vp.user_id
         where vp.church_id = $1 and (u.first_name || ' ' || u.last_name) ilike $2
         limit 1`,
        [churchId, `%${name}%`],
      );
      return rows[0] ? { volunteerProfileId: rows[0].id, firstName: rows[0].first_name, lastName: rows[0].last_name } : null;
    });
  }

  async whoCanReplace(churchId: string, volunteerProfileId: string): Promise<VolunteerSummary[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<{ id: string; first_name: string; last_name: string }>(
        `select distinct vp2.id, u2.first_name, u2.last_name
         from volunteer_skills vs1
         join volunteer_skills vs2 on vs2.skill_id = vs1.skill_id and vs2.experience_level >= vs1.experience_level
         join volunteer_profiles vp2 on vp2.id = vs2.volunteer_profile_id
         join users u2 on u2.id = vp2.user_id
         where vs1.volunteer_profile_id = $2
           and vp2.church_id = $1
           and vp2.status = 'ACTIVE'
           and vp2.id != $2
         order by u2.first_name asc`,
        [churchId, volunteerProfileId],
      );
      return rows.map((r) => ({ volunteerProfileId: r.id, firstName: r.first_name, lastName: r.last_name }));
    });
  }

  async whoNeedsTraining(churchId: string): Promise<VolunteerSummary[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<{ id: string; first_name: string; last_name: string }>(
        `select vp.id, u.first_name, u.last_name
         from volunteer_profiles vp
         join users u on u.id = vp.user_id
         where vp.church_id = $1 and vp.status = 'ACTIVE'
           and not exists (
             select 1 from training_records tr where tr.volunteer_profile_id = vp.id and tr.completed_at is not null
           )
         order by u.first_name asc, u.last_name asc`,
        [churchId],
      );
      return rows.map((r) => ({ volunteerProfileId: r.id, firstName: r.first_name, lastName: r.last_name }));
    });
  }
}
