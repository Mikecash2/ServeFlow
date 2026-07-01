import { Injectable } from "@nestjs/common";
import { TenantDbService } from "../../database/tenant-db.service";

export interface VolunteerSkillRecord {
  skillId: string;
  skillName: string;
  experienceLevel: number;
  yearsExperience: number | null;
}

@Injectable()
export class SkillsRepository {
  constructor(private readonly tenantDb: TenantDbService) {}

  /**
   * Skills are per-church reference data (e.g. "Camera Operation", "Sound
   * Mixing") that volunteers then get tagged against with an experience
   * level — this upserts the skill by name so leaders don't have to
   * pre-create a skill catalog before assigning it to someone.
   */
  async addSkillToVolunteer(params: {
    churchId: string;
    volunteerProfileId: string;
    skillName: string;
    experienceLevel: number;
    yearsExperience?: number;
  }): Promise<VolunteerSkillRecord> {
    return this.tenantDb.runInTenantContext(params.churchId, async (query) => {
      let skill = (
        await query<{ id: string; name: string }>(
          `select id, name from skills where church_id = $1 and name = $2`,
          [params.churchId, params.skillName],
        )
      )[0];
      if (!skill) {
        skill = (
          await query<{ id: string; name: string }>(
            `insert into skills (church_id, name) values ($1, $2) returning id, name`,
            [params.churchId, params.skillName],
          )
        )[0];
      }

      await query(
        `insert into volunteer_skills (volunteer_profile_id, skill_id, experience_level, years_experience)
         values ($1, $2, $3, $4)
         on conflict (volunteer_profile_id, skill_id)
         do update set experience_level = excluded.experience_level, years_experience = excluded.years_experience`,
        [params.volunteerProfileId, skill.id, params.experienceLevel, params.yearsExperience ?? null],
      );

      return {
        skillId: skill.id,
        skillName: skill.name,
        experienceLevel: params.experienceLevel,
        yearsExperience: params.yearsExperience ?? null,
      };
    });
  }

  async listForVolunteer(churchId: string, volunteerProfileId: string): Promise<VolunteerSkillRecord[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<{
        skill_id: string;
        name: string;
        experience_level: number;
        years_experience: number | null;
      }>(
        `select s.id as skill_id, s.name, vs.experience_level, vs.years_experience
         from volunteer_skills vs
         join skills s on s.id = vs.skill_id
         where vs.volunteer_profile_id = $1
         order by s.name asc`,
        [volunteerProfileId],
      );
      return rows.map((r) => ({
        skillId: r.skill_id,
        skillName: r.name,
        experienceLevel: r.experience_level,
        yearsExperience: r.years_experience,
      }));
    });
  }
}
