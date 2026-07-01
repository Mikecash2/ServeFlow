import { Injectable } from "@nestjs/common";
import { TenantDbService } from "../../database/tenant-db.service";
import { computeReliabilityScore, ReliabilityStats } from "./reliability.types";

/**
 * Recomputes every volunteer's reliability score from real attendance
 * history (docs/08-roadmap.md Phase 7 exit criteria). The roadmap describes
 * this as "a nightly job" — there is no cron/scheduler infrastructure in
 * this sandbox (no persistent background process manager available), so
 * this ships as an on-demand endpoint a Church Admin can trigger instead.
 * On a real deployment this is a one-line change: call
 * `recomputeForChurch` from a scheduled job (e.g. a Vercel/Fly.io cron
 * trigger or a BullMQ repeatable job) instead of an HTTP handler — the
 * method itself doesn't change.
 */
@Injectable()
export class ReliabilityService {
  constructor(private readonly tenantDb: TenantDbService) {}

  async recomputeForChurch(churchId: string): Promise<Array<{ volunteerProfileId: string; reliabilityScore: number }>> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<{ volunteer_profile_id: string; attended: string; no_shows: string; late_cancellations: string }>(
        `select
           vp.id as volunteer_profile_id,
           count(*) filter (where asn.declined_at is null and ci.id is not null) as attended,
           count(*) filter (where asn.declined_at is null and ci.id is null and s.date < now()) as no_shows,
           count(*) filter (where asn.declined_at is not null) as late_cancellations
         from volunteer_profiles vp
         left join assignments asn on asn.volunteer_profile_id = vp.id
         left join schedule_runs run on run.id = asn.schedule_run_id and run.status = 'COMPLETED'
         left join services s on s.id = run.service_id and s.date >= now() - interval '365 days'
         left join attendance a on a.service_id = s.id and a.volunteer_profile_id = vp.id
         left join check_ins ci on ci.attendance_id = a.id
         where vp.church_id = $1
         group by vp.id`,
        [churchId],
      );

      const results: Array<{ volunteerProfileId: string; reliabilityScore: number }> = [];
      for (const row of rows) {
        const stats: ReliabilityStats = {
          volunteerProfileId: row.volunteer_profile_id,
          attended: Number(row.attended),
          noShows: Number(row.no_shows),
          lateCancellations: Number(row.late_cancellations),
        };
        const score = computeReliabilityScore(stats);
        await query(`update volunteer_profiles set reliability_score = $2, updated_at = now() where id = $1`, [
          stats.volunteerProfileId,
          score,
        ]);
        results.push({ volunteerProfileId: stats.volunteerProfileId, reliabilityScore: score });
      }
      return results;
    });
  }
}
