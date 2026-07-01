import { Injectable } from "@nestjs/common";
import { TenantDbService } from "../../database/tenant-db.service";

export interface CoverageTrendPoint {
  serviceId: string;
  title: string;
  date: string;
  coveragePct: number | null;
}

export interface ReliabilityBucket {
  bucket: string;
  count: number;
}

export interface BurnoutRiskEntry {
  volunteerProfileId: string;
  firstName: string;
  lastName: string;
  trailing8WeekAssignments: number;
  ministryAverage: number;
}

export interface EquipmentUsageEntry {
  category: string;
  reservationCount: number;
  faultCount: number;
}

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly tenantDb: TenantDbService) {}

  async getCoverageTrend(churchId: string, from?: string, to?: string): Promise<CoverageTrendPoint[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<{ service_id: string; title: string; date: string; coverage_pct: number | null }>(
        `select distinct on (s.id) s.id as service_id, s.title, s.date, run.coverage_pct
         from services s
         left join schedule_runs run on run.service_id = s.id and run.status = 'COMPLETED'
         where s.church_id = $1
           and ($2::timestamptz is null or s.date >= $2::timestamptz)
           and ($3::timestamptz is null or s.date <= $3::timestamptz)
         order by s.id, run.completed_at desc`,
        [churchId, from ?? null, to ?? null],
      );
      return rows
        .map((r) => ({ serviceId: r.service_id, title: r.title, date: r.date, coveragePct: r.coverage_pct }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });
  }

  async getReliabilityDistribution(churchId: string): Promise<ReliabilityBucket[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<{ bucket: string; count: string }>(
        `select
           case
             when reliability_score < 0.5 then '0.0-0.5'
             when reliability_score < 0.7 then '0.5-0.7'
             when reliability_score < 0.85 then '0.7-0.85'
             else '0.85-1.0'
           end as bucket,
           count(*) as count
         from volunteer_profiles
         where church_id = $1 and status = 'ACTIVE'
         group by bucket`,
        [churchId],
      );
      return rows.map((r) => ({ bucket: r.bucket, count: Number(r.count) }));
    });
  }

  /** Flags volunteers whose trailing-8-week assignment count is at least 1.5x their ministry's average — the same signal `workloadBalance` uses in scoring, surfaced here for leaders instead of just influencing future assignments. */
  async getBurnoutRisk(churchId: string): Promise<BurnoutRiskEntry[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<{
        volunteer_profile_id: string; first_name: string; last_name: string; assignment_count: string; ministry_avg: string;
      }>(
        `with volunteer_counts as (
           select vp.id as volunteer_profile_id, u.first_name, u.last_name, m.ministry_id,
             count(asn.id) filter (
               where asn.declined_at is null and s.date >= now() - interval '56 days' and s.date < now()
             ) as assignment_count
           from volunteer_profiles vp
           join users u on u.id = vp.user_id
           join memberships m on m.user_id = vp.user_id and m.church_id = vp.church_id and m.ministry_id is not null
           left join assignments asn on asn.volunteer_profile_id = vp.id
           left join schedule_runs run on run.id = asn.schedule_run_id and run.status = 'COMPLETED'
           left join services s on s.id = run.service_id
           where vp.church_id = $1
           group by vp.id, u.first_name, u.last_name, m.ministry_id
         ),
         ministry_averages as (
           select ministry_id, avg(assignment_count) as avg_count from volunteer_counts group by ministry_id
         )
         select vc.volunteer_profile_id, vc.first_name, vc.last_name, vc.assignment_count, ma.avg_count as ministry_avg
         from volunteer_counts vc
         join ministry_averages ma on ma.ministry_id = vc.ministry_id
         where ma.avg_count > 0 and vc.assignment_count >= ma.avg_count * 1.5`,
        [churchId],
      );
      return rows.map((r) => ({
        volunteerProfileId: r.volunteer_profile_id,
        firstName: r.first_name,
        lastName: r.last_name,
        trailing8WeekAssignments: Number(r.assignment_count),
        ministryAverage: Math.round(Number(r.ministry_avg) * 10) / 10,
      }));
    });
  }

  async getEquipmentUsage(churchId: string): Promise<EquipmentUsageEntry[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<{ category: string; reservation_count: string; fault_count: string }>(
        `select e.category,
           count(distinct r.id) as reservation_count,
           count(distinct f.id) as fault_count
         from equipment e
         left join equipment_reservations r on r.equipment_id = e.id
         left join fault_reports f on f.equipment_id = e.id
         where e.church_id = $1
         group by e.category
         order by e.category asc`,
        [churchId],
      );
      return rows.map((r) => ({
        category: r.category,
        reservationCount: Number(r.reservation_count),
        faultCount: Number(r.fault_count),
      }));
    });
  }
}
