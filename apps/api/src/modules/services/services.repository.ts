import { Injectable } from "@nestjs/common";
import { TenantDbService } from "../../database/tenant-db.service";

export type ServiceType =
  | "SUNDAY_SERVICE" | "WEDNESDAY_SERVICE" | "PRAYER_MEETING"
  | "CONFERENCE" | "WEDDING" | "FUNERAL" | "SPECIAL_EVENT";

export interface ServiceRecord {
  id: string;
  churchId: string;
  campusId: string;
  type: ServiceType;
  title: string;
  venue: string | null;
  date: string;
  setupStart: string | null;
  soundcheck: string | null;
  doorsOpen: string | null;
  serviceStart: string;
  serviceEnd: string | null;
  derigEnd: string | null;
  expectedAttendance: number | null;
  notes: string | null;
  guestSpeaker: string | null;
  recurrenceRule: string | null;
}

interface ServiceRow {
  id: string; church_id: string; campus_id: string; type: ServiceType; title: string;
  venue: string | null; date: string; setup_start: string | null; soundcheck: string | null;
  doors_open: string | null; service_start: string; service_end: string | null;
  derig_end: string | null; expected_attendance: number | null; notes: string | null;
  guest_speaker: string | null; recurrence_rule: string | null;
}

function toRecord(row: ServiceRow): ServiceRecord {
  return {
    id: row.id,
    churchId: row.church_id,
    campusId: row.campus_id,
    type: row.type,
    title: row.title,
    venue: row.venue,
    date: row.date,
    setupStart: row.setup_start,
    soundcheck: row.soundcheck,
    doorsOpen: row.doors_open,
    serviceStart: row.service_start,
    serviceEnd: row.service_end,
    derigEnd: row.derig_end,
    expectedAttendance: row.expected_attendance,
    notes: row.notes,
    guestSpeaker: row.guest_speaker,
    recurrenceRule: row.recurrence_rule,
  };
}

const FIELDS = `id, church_id, campus_id, type, title, venue, date, setup_start, soundcheck,
  doors_open, service_start, service_end, derig_end, expected_attendance, notes,
  guest_speaker, recurrence_rule`;

@Injectable()
export class ServicesRepository {
  constructor(private readonly tenantDb: TenantDbService) {}

  async create(params: {
    churchId: string; campusId: string; type: ServiceType; title: string; venue?: string;
    date: string; setupStart?: string; soundcheck?: string; doorsOpen?: string;
    serviceStart: string; serviceEnd?: string; derigEnd?: string; expectedAttendance?: number;
    notes?: string; guestSpeaker?: string; recurrenceRule?: string;
  }): Promise<ServiceRecord> {
    return this.tenantDb.runInTenantContext(params.churchId, async (query) => {
      const rows = await query<ServiceRow>(
        `insert into services
           (church_id, campus_id, type, title, venue, date, setup_start, soundcheck,
            doors_open, service_start, service_end, derig_end, expected_attendance,
            notes, guest_speaker, recurrence_rule)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         returning ${FIELDS}`,
        [
          params.churchId, params.campusId, params.type, params.title, params.venue ?? null,
          params.date, params.setupStart ?? null, params.soundcheck ?? null, params.doorsOpen ?? null,
          params.serviceStart, params.serviceEnd ?? null, params.derigEnd ?? null,
          params.expectedAttendance ?? null, params.notes ?? null, params.guestSpeaker ?? null,
          params.recurrenceRule ?? null,
        ],
      );
      return toRecord(rows[0]);
    });
  }

  async listForChurch(churchId: string, from?: string, to?: string, type?: ServiceType): Promise<ServiceRecord[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<ServiceRow>(
        `select ${FIELDS} from services
         where church_id = $1
           and ($2::timestamptz is null or date >= $2::timestamptz)
           and ($3::timestamptz is null or date <= $3::timestamptz)
           and ($4::text is null or type = $4::service_type)
         order by date asc`,
        [churchId, from ?? null, to ?? null, type ?? null],
      );
      return rows.map(toRecord);
    });
  }

  async findById(churchId: string, serviceId: string): Promise<ServiceRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<ServiceRow>(
        `select ${FIELDS} from services where id = $1 and church_id = $2`,
        [serviceId, churchId],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }

  async update(
    churchId: string,
    serviceId: string,
    patch: Partial<{
      title: string; venue: string; setupStart: string; soundcheck: string; doorsOpen: string;
      serviceStart: string; serviceEnd: string; derigEnd: string; expectedAttendance: number;
      notes: string; guestSpeaker: string;
    }>,
  ): Promise<ServiceRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<ServiceRow>(
        `update services set
           title = coalesce($3, title),
           venue = coalesce($4, venue),
           setup_start = coalesce($5, setup_start),
           soundcheck = coalesce($6, soundcheck),
           doors_open = coalesce($7, doors_open),
           service_start = coalesce($8, service_start),
           service_end = coalesce($9, service_end),
           derig_end = coalesce($10, derig_end),
           expected_attendance = coalesce($11, expected_attendance),
           notes = coalesce($12, notes),
           guest_speaker = coalesce($13, guest_speaker),
           updated_at = now()
         where id = $1 and church_id = $2
         returning ${FIELDS}`,
        [
          serviceId, churchId, patch.title, patch.venue, patch.setupStart, patch.soundcheck,
          patch.doorsOpen, patch.serviceStart, patch.serviceEnd, patch.derigEnd,
          patch.expectedAttendance, patch.notes, patch.guestSpeaker,
        ],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    });
  }

  /**
   * Materializes N shifted copies of an existing service — e.g. every
   * Sunday for the next 8 weeks — closing the Phase 3 deferral. Each copy
   * shares the same campus/type/venue/notes but has every timeline field
   * shifted by the same delta as its occurrence date. Roles and tasks are
   * NOT copied (a documented scope simplification, see docs/08-roadmap.md
   * Phase 10) — a leader adds those to each generated occurrence, or a
   * future "copy roles from template" feature could automate it.
   */
  async createShiftedCopies(
    churchId: string,
    template: ServiceRecord,
    occurrenceDates: Date[],
  ): Promise<ServiceRecord[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const templateStart = new Date(template.serviceStart).getTime();
      const results: ServiceRecord[] = [];

      const shift = (iso: string | null, deltaMs: number): string | null =>
        iso ? new Date(new Date(iso).getTime() + deltaMs).toISOString() : null;

      for (const occurrenceDate of occurrenceDates) {
        const deltaMs = occurrenceDate.getTime() - templateStart;
        const rows = await query<ServiceRow>(
          `insert into services
             (church_id, campus_id, type, title, venue, date, setup_start, soundcheck,
              doors_open, service_start, service_end, derig_end, expected_attendance,
              notes, guest_speaker)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           returning ${FIELDS}`,
          [
            churchId, template.campusId, template.type, template.title, template.venue,
            shift(template.date, deltaMs), shift(template.setupStart, deltaMs), shift(template.soundcheck, deltaMs),
            shift(template.doorsOpen, deltaMs), occurrenceDate.toISOString(), shift(template.serviceEnd, deltaMs),
            shift(template.derigEnd, deltaMs), template.expectedAttendance, template.notes, template.guestSpeaker,
          ],
        );
        results.push(toRecord(rows[0]));
      }
      return results;
    });
  }

  async cancel(churchId: string, serviceId: string): Promise<boolean> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<{ id: string }>(
        `delete from services where id = $1 and church_id = $2 returning id`,
        [serviceId, churchId],
      );
      return rows.length > 0;
    });
  }
}
