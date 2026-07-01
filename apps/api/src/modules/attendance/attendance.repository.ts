import { Injectable } from "@nestjs/common";
import { TenantDbService } from "../../database/tenant-db.service";

export type CheckInMethod = "QR_CODE" | "MANUAL" | "GPS";

export interface CheckInResult {
  attendanceId: string;
  volunteerProfileId: string;
  checkedInAt: string;
  isLate: boolean;
  method: CheckInMethod;
}

export interface RosterEntry {
  volunteerProfileId: string;
  firstName: string;
  lastName: string;
  roleName: string;
  checkedInAt: string | null;
  isLate: boolean | null;
  method: CheckInMethod | null;
}

@Injectable()
export class AttendanceRepository {
  constructor(private readonly tenantDb: TenantDbService) {}

  /**
   * Upserts an Attendance row for (service, volunteer) then upserts its
   * CheckIn — a volunteer can only check in once per service, but re-scanning
   * their QR just refreshes the existing check-in rather than erroring.
   * `isLate` compares against the service's `serviceStart`, not `setupStart`
   * — a simplification (docs/08-roadmap.md): lateness "for what" (setup
   * crew vs. general volunteer) would need per-assignment expected-arrival
   * times this build doesn't track yet.
   */
  async checkIn(params: {
    churchId: string;
    serviceId: string;
    volunteerProfileId: string;
    checkedInByUserId: string;
    method: CheckInMethod;
    serviceStart: string;
    gpsLat?: number;
    gpsLng?: number;
  }): Promise<CheckInResult> {
    return this.tenantDb.runInTenantContext(params.churchId, async (query) => {
      const existing = await query<{ id: string }>(
        `select id from attendance where service_id = $1 and volunteer_profile_id = $2`,
        [params.serviceId, params.volunteerProfileId],
      );
      let attendanceId = existing[0]?.id;
      if (!attendanceId) {
        const created = await query<{ id: string }>(
          `insert into attendance (service_id, volunteer_profile_id) values ($1, $2) returning id`,
          [params.serviceId, params.volunteerProfileId],
        );
        attendanceId = created[0].id;
      }

      const isLate = new Date() > new Date(params.serviceStart);

      const rows = await query<{ attendance_id: string; checked_in_at: string; is_late: boolean; method: CheckInMethod }>(
        `insert into check_ins (attendance_id, user_id, method, is_late, gps_lat, gps_lng)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (attendance_id) do update set
           user_id = excluded.user_id, method = excluded.method, checked_in_at = now(),
           is_late = excluded.is_late, gps_lat = excluded.gps_lat, gps_lng = excluded.gps_lng
         returning attendance_id, checked_in_at, is_late, method`,
        [attendanceId, params.checkedInByUserId, params.method, isLate, params.gpsLat ?? null, params.gpsLng ?? null],
      );
      const r = rows[0];
      return { attendanceId: r.attendance_id, volunteerProfileId: params.volunteerProfileId, checkedInAt: r.checked_in_at, isLate: r.is_late, method: r.method };
    });
  }

  /**
   * Roster = volunteers assigned in the most recent COMPLETED schedule run
   * for this service, joined with their check-in status (null if they
   * haven't checked in yet). Empty if no schedule has been generated —
   * matching the dashboard's "no schedule generated yet" state from Phase 5.
   */
  async getRoster(churchId: string, serviceId: string): Promise<RosterEntry[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<{
        volunteer_profile_id: string; first_name: string; last_name: string; role_name: string;
        checked_in_at: string | null; is_late: boolean | null; method: CheckInMethod | null;
      }>(
        `select vp.id as volunteer_profile_id, u.first_name, u.last_name, sr.name as role_name,
                ci.checked_in_at, ci.is_late, ci.method
         from assignments asn
         join schedule_runs run on run.id = asn.schedule_run_id
         join service_roles sr on sr.id = asn.service_role_id
         join volunteer_profiles vp on vp.id = asn.volunteer_profile_id
         join users u on u.id = vp.user_id
         left join attendance a on a.service_id = sr.service_id and a.volunteer_profile_id = vp.id
         left join check_ins ci on ci.attendance_id = a.id
         where sr.service_id = $1
           and asn.declined_at is null
           and run.id = (
             select id from schedule_runs where service_id = $1 and status = 'COMPLETED'
             order by completed_at desc limit 1
           )
         order by u.first_name asc, u.last_name asc`,
        [serviceId],
      );
      return rows.map((r) => ({
        volunteerProfileId: r.volunteer_profile_id,
        firstName: r.first_name,
        lastName: r.last_name,
        roleName: r.role_name,
        checkedInAt: r.checked_in_at,
        isLate: r.is_late,
        method: r.method,
      }));
    });
  }
}
