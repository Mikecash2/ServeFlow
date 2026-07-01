import { Injectable } from "@nestjs/common";
import { TenantDbService } from "../../database/tenant-db.service";

export interface ServiceRoleRecord {
  id: string;
  serviceId: string;
  ministryId: string;
  name: string;
  minRequired: number;
  maxAllowed: number;
}

interface ServiceRoleRow {
  id: string; service_id: string; ministry_id: string; name: string;
  min_required: number; max_allowed: number;
}

function toRecord(row: ServiceRoleRow): ServiceRoleRecord {
  return {
    id: row.id,
    serviceId: row.service_id,
    ministryId: row.ministry_id,
    name: row.name,
    minRequired: row.min_required,
    maxAllowed: row.max_allowed,
  };
}

export interface RequiredSkillRecord {
  id: string;
  skillId: string;
  skillName: string;
  minExperienceLevel: number;
}

@Injectable()
export class ServiceRolesRepository {
  constructor(private readonly tenantDb: TenantDbService) {}

  async create(params: {
    churchId: string; serviceId: string; ministryId: string; name: string;
    minRequired?: number; maxAllowed?: number;
  }): Promise<ServiceRoleRecord> {
    return this.tenantDb.runInTenantContext(params.churchId, async (query) => {
      const rows = await query<ServiceRoleRow>(
        `insert into service_roles (service_id, ministry_id, name, min_required, max_allowed)
         values ($1, $2, $3, $4, $5)
         returning id, service_id, ministry_id, name, min_required, max_allowed`,
        [params.serviceId, params.ministryId, params.name, params.minRequired ?? 1, params.maxAllowed ?? 1],
      );
      return toRecord(rows[0]);
    });
  }

  async listForService(churchId: string, serviceId: string): Promise<ServiceRoleRecord[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<ServiceRoleRow>(
        `select id, service_id, ministry_id, name, min_required, max_allowed
         from service_roles where service_id = $1 order by name asc`,
        [serviceId],
      );
      return rows.map(toRecord);
    });
  }

  async findById(churchId: string, serviceId: string, roleId: string): Promise<ServiceRoleRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<ServiceRoleRow>(
        `select id, service_id, ministry_id, name, min_required, max_allowed
         from service_roles where id = $1 and service_id = $2`,
        [roleId, serviceId],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }

  /** Looks up a role without already knowing its serviceId — used by the
   * decline/re-solve flow, which only has a serviceRoleId from an Assignment. */
  async findByRoleId(churchId: string, roleId: string): Promise<ServiceRoleRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<ServiceRoleRow>(
        `select id, service_id, ministry_id, name, min_required, max_allowed
         from service_roles where id = $1`,
        [roleId],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }

  async update(
    churchId: string,
    roleId: string,
    patch: Partial<{ name: string; minRequired: number; maxAllowed: number }>,
  ): Promise<ServiceRoleRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<ServiceRoleRow>(
        `update service_roles set
           name = coalesce($2, name),
           min_required = coalesce($3, min_required),
           max_allowed = coalesce($4, max_allowed)
         where id = $1
         returning id, service_id, ministry_id, name, min_required, max_allowed`,
        [roleId, patch.name, patch.minRequired, patch.maxAllowed],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }

  async addRequiredSkill(params: {
    churchId: string; serviceRoleId: string; skillName: string; minExperienceLevel: number;
  }): Promise<RequiredSkillRecord> {
    return this.tenantDb.runInTenantContext(params.churchId, async (query) => {
      // Skill is looked up by name only within this church's `skills` table —
      // it does not resolve which church via serviceRoleId here, so the
      // caller (controller) must already have verified serviceRoleId belongs
      // to this church before calling this method.
      let skill = (
        await query<{ id: string }>(`select id from skills where church_id = $1 and name = $2`, [
          params.churchId,
          params.skillName,
        ])
      )[0];
      if (!skill) {
        skill = (
          await query<{ id: string }>(`insert into skills (church_id, name) values ($1, $2) returning id`, [
            params.churchId,
            params.skillName,
          ])
        )[0];
      }

      await query(
        `insert into service_role_skills (service_role_id, skill_id, min_experience_level)
         values ($1, $2, $3)
         on conflict (service_role_id, skill_id) do update set min_experience_level = excluded.min_experience_level`,
        [params.serviceRoleId, skill.id, params.minExperienceLevel],
      );

      return { id: skill.id, skillId: skill.id, skillName: params.skillName, minExperienceLevel: params.minExperienceLevel };
    });
  }

  async listRequiredSkills(churchId: string, serviceRoleId: string): Promise<RequiredSkillRecord[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<{ id: string; skill_id: string; name: string; min_experience_level: number }>(
        `select srs.id, s.id as skill_id, s.name, srs.min_experience_level
         from service_role_skills srs
         join skills s on s.id = srs.skill_id
         where srs.service_role_id = $1`,
        [serviceRoleId],
      );
      return rows.map((r) => ({ id: r.id, skillId: r.skill_id, skillName: r.name, minExperienceLevel: r.min_experience_level }));
    });
  }
}
