import { Injectable } from "@nestjs/common";
import { TenantDbService } from "../../database/tenant-db.service";
import { CandidateRow } from "./scheduling.types";

@Injectable()
export class CandidatesRepository {
  constructor(private readonly tenantDb: TenantDbService) {}

  /**
   * Hard-constraint candidate resolution for one ServiceRole (docs/04-ai-scheduling-algorithm.md §2):
   *   1. Active status
   *   2. Belongs to the role's ministry (a ministry-scoped Membership row)
   *   3. Marked AVAILABLE for the service's date
   *   4. Meets every required skill's minimum experience level (if the role has any)
   *   5. Not already assigned (and not declined) to a different service on the same date
   *
   * `excludeVolunteerProfileIds` additionally removes volunteers already
   * placed in another role during *this* schedule run — a volunteer can
   * only fill one role per service.
   */
  async resolveCandidates(
    churchId: string,
    serviceRoleId: string,
    excludeVolunteerProfileIds: string[],
  ): Promise<CandidateRow[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<{
        volunteer_profile_id: string;
        first_name: string;
        last_name: string;
        reliability_score: number;
        preferred_role_names: string[];
      }>(
        `select distinct vp.id as volunteer_profile_id, u.first_name, u.last_name,
                vp.reliability_score, vp.preferred_role_names
         from service_roles sr
         join services s on s.id = sr.service_id
         join memberships m on m.ministry_id = sr.ministry_id
           and m.church_id = s.church_id and m.role = 'VOLUNTEER' and m.is_active = true
         join volunteer_profiles vp on vp.user_id = m.user_id and vp.church_id = s.church_id
         join users u on u.id = vp.user_id
         where sr.id = $1
           and vp.status = 'ACTIVE'
           and not (vp.id = any($2::text[]))
           and exists (
             select 1 from availability a
             where a.volunteer_profile_id = vp.id and a.date = s.date::date and a.status = 'AVAILABLE'
           )
           and not exists (
             select 1 from service_role_skills srs
             where srs.service_role_id = sr.id
               and not exists (
                 select 1 from volunteer_skills vs
                 where vs.volunteer_profile_id = vp.id
                   and vs.skill_id = srs.skill_id
                   and vs.experience_level >= srs.min_experience_level
               )
           )
           and not exists (
             select 1 from assignments asn
             join schedule_runs run on run.id = asn.schedule_run_id
             join services s2 on s2.id = run.service_id
             where asn.volunteer_profile_id = vp.id
               and asn.declined_at is null
               and s2.id != s.id
               and s2.date::date = s.date::date
           )`,
        [serviceRoleId, excludeVolunteerProfileIds],
      );
      return rows.map((r) => ({
        volunteerProfileId: r.volunteer_profile_id,
        firstName: r.first_name,
        lastName: r.last_name,
        reliabilityScore: r.reliability_score,
        preferredRoleNames: r.preferred_role_names,
      }));
    });
  }

  /** Average skill experience level (0-1 normalized) against a role's required skills. */
  async getSkillMatch(churchId: string, volunteerProfileId: string, serviceRoleId: string): Promise<number> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<{ experience_level: number; min_experience_level: number }>(
        `select vs.experience_level, srs.min_experience_level
         from service_role_skills srs
         join volunteer_skills vs on vs.skill_id = srs.skill_id and vs.volunteer_profile_id = $2
         where srs.service_role_id = $1`,
        [serviceRoleId, volunteerProfileId],
      );
      if (rows.length === 0) return 1.0; // role has no required skills — neutral score for everyone
      const avg = rows.reduce((sum, r) => sum + Math.min(r.experience_level / 5, 1), 0) / rows.length;
      return avg;
    });
  }

  /** Count of non-declined assignments for this volunteer in the trailing N days before `beforeDate`. */
  async getTrailingAssignmentCount(churchId: string, volunteerProfileId: string, beforeDate: string, days: number): Promise<number> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<{ count: string }>(
        `select count(*) from assignments asn
         join schedule_runs run on run.id = asn.schedule_run_id
         join services s on s.id = run.service_id
         where asn.volunteer_profile_id = $1
           and asn.declined_at is null
           and s.date::date < $2::date
           and s.date::date >= ($2::date - ($3 || ' days')::interval)`,
        [volunteerProfileId, beforeDate, days],
      );
      return Number(rows[0]?.count ?? 0);
    });
  }
}
