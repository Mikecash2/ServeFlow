import { Injectable } from "@nestjs/common";
import { TenantDbService } from "../../database/tenant-db.service";

export type AvailabilityStatus = "AVAILABLE" | "UNAVAILABLE" | "LATE" | "LEAVE_EARLY" | "MAYBE";

export interface AvailabilityRecord {
  id: string;
  volunteerProfileId: string;
  date: string;
  status: AvailabilityStatus;
  note: string | null;
  recurrenceRule: string | null;
  isHolidayMode: boolean;
}

interface AvailabilityRow {
  id: string;
  volunteer_profile_id: string;
  date: string;
  status: AvailabilityStatus;
  note: string | null;
  recurrence_rule: string | null;
  is_holiday_mode: boolean;
}

function toRecord(row: AvailabilityRow): AvailabilityRecord {
  return {
    id: row.id,
    volunteerProfileId: row.volunteer_profile_id,
    date: row.date,
    status: row.status,
    note: row.note,
    recurrenceRule: row.recurrence_rule,
    isHolidayMode: row.is_holiday_mode,
  };
}

@Injectable()
export class AvailabilityRepository {
  constructor(private readonly tenantDb: TenantDbService) {}

  async submit(params: {
    churchId: string;
    volunteerProfileId: string;
    date: string;
    status: AvailabilityStatus;
    note?: string;
    recurrenceRule?: string;
    isHolidayMode?: boolean;
  }): Promise<AvailabilityRecord> {
    return this.tenantDb.runInTenantContext(params.churchId, async (query) => {
      const rows = await query<AvailabilityRow>(
        `insert into availability
           (volunteer_profile_id, date, status, note, recurrence_rule, is_holiday_mode)
         values ($1, $2, $3, $4, $5, $6)
         returning id, volunteer_profile_id, date, status, note, recurrence_rule, is_holiday_mode`,
        [
          params.volunteerProfileId,
          params.date,
          params.status,
          params.note ?? null,
          params.recurrenceRule ?? null,
          params.isHolidayMode ?? false,
        ],
      );
      return toRecord(rows[0]);
    });
  }

  async listForVolunteer(
    churchId: string,
    volunteerProfileId: string,
    from?: string,
    to?: string,
  ): Promise<AvailabilityRecord[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<AvailabilityRow>(
        `select id, volunteer_profile_id, date, status, note, recurrence_rule, is_holiday_mode
         from availability
         where volunteer_profile_id = $1
           and ($2::date is null or date >= $2::date)
           and ($3::date is null or date <= $3::date)
         order by date asc`,
        [volunteerProfileId, from ?? null, to ?? null],
      );
      return rows.map(toRecord);
    });
  }

  async update(
    churchId: string,
    availabilityId: string,
    patch: { status?: AvailabilityStatus; note?: string },
  ): Promise<AvailabilityRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<AvailabilityRow>(
        `update availability set
           status = coalesce($2, status),
           note = coalesce($3, note)
         where id = $1
         returning id, volunteer_profile_id, date, status, note, recurrence_rule, is_holiday_mode`,
        [availabilityId, patch.status, patch.note],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }
}
