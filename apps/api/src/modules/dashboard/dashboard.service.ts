import { Injectable } from "@nestjs/common";
import { TenantDbService } from "../../database/tenant-db.service";

export interface UpcomingServiceSummary {
  id: string;
  title: string;
  type: string;
  date: string;
}

export interface FocusServiceSummary {
  id: string;
  title: string;
  date: string;
  coveragePct: number | null;
  coverageSummary: string | null;
  setupTasksDone: number;
  setupTasksTotal: number;
  derigTasksDone: number;
  derigTasksTotal: number;
  missingRoles: string[];
}

export interface DashboardSummary {
  upcomingServices: UpcomingServiceSummary[];
  focusService: FocusServiceSummary | null;
  availabilityPct: number | null;
  activeVolunteerCount: number;
  recommendations: string[];
}

/**
 * Aggregates the widgets described in docs/01-PRD.md §4.1 and mocked in
 * ServeFlow-Docs/dashboard-mockup.html: coverage %, availability %,
 * setup/de-rig progress, missing volunteers, AI recommendations. The
 * architecture doc (§1) sketches this as a GraphQL resolver
 * (`dashboardSummary`) specifically to avoid a chatty multi-round-trip
 * dashboard load; this build exposes the same aggregation as a single REST
 * endpoint instead, since standing up a whole GraphQL server for one
 * resolver isn't proportionate yet — the point (one round trip, one
 * server-side join of several concerns) is preserved either way. Revisit if
 * more GraphQL-shaped reads accumulate.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly tenantDb: TenantDbService) {}

  async getSummary(churchId: string): Promise<DashboardSummary> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const upcoming = await query<{ id: string; title: string; type: string; date: string }>(
        `select id, title, type, date from services
         where church_id = $1 and date >= now() - interval '1 day'
         order by date asc limit 5`,
        [churchId],
      );

      const focus = upcoming[0] ?? null;
      let focusService: FocusServiceSummary | null = null;

      if (focus) {
        const latestRun = await query<{ id: string; coverage_pct: number | null; summary: string | null }>(
          `select id, coverage_pct, summary from schedule_runs
           where service_id = $1 and status = 'COMPLETED'
           order by completed_at desc limit 1`,
          [focus.id],
        );

        const taskCounts = await query<{ phase: string; done: string; total: string }>(
          `select phase, count(*) filter (where status = 'COMPLETED') as done, count(*) as total
           from tasks where service_id = $1 group by phase`,
          [focus.id],
        );
        const setupRow = taskCounts.find((r) => r.phase === "SETUP");
        const derigRow = taskCounts.find((r) => r.phase === "DERIG");

        const roles = await query<{ id: string; name: string; min_required: number }>(
          `select sr.id, sr.name, sr.min_required from service_roles sr where sr.service_id = $1`,
          [focus.id],
        );
        const missingRoles: string[] = [];
        for (const role of roles) {
          const filledCount = await query<{ count: string }>(
            `select count(*) from assignments a
             join schedule_runs run on run.id = a.schedule_run_id
             where a.service_role_id = $1 and run.status = 'COMPLETED' and a.declined_at is null`,
            [role.id],
          );
          if (Number(filledCount[0]?.count ?? 0) < role.min_required) missingRoles.push(role.name);
        }

        focusService = {
          id: focus.id,
          title: focus.title,
          date: focus.date,
          coveragePct: latestRun[0]?.coverage_pct ?? null,
          coverageSummary: latestRun[0]?.summary ?? null,
          setupTasksDone: Number(setupRow?.done ?? 0),
          setupTasksTotal: Number(setupRow?.total ?? 0),
          derigTasksDone: Number(derigRow?.done ?? 0),
          derigTasksTotal: Number(derigRow?.total ?? 0),
          missingRoles,
        };
      }

      const activeVolunteers = await query<{ count: string }>(
        `select count(*) from volunteer_profiles where church_id = $1 and status = 'ACTIVE'`,
        [churchId],
      );
      const activeVolunteerCount = Number(activeVolunteers[0]?.count ?? 0);

      let availabilityPct: number | null = null;
      const recommendations: string[] = [];

      if (focus && activeVolunteerCount > 0) {
        const submitted = await query<{ count: string }>(
          `select count(distinct vp.id) from availability a
           join volunteer_profiles vp on vp.id = a.volunteer_profile_id
           where vp.church_id = $1 and a.date = $2::date`,
          [churchId, focus.date],
        );
        availabilityPct = Math.round((Number(submitted[0]?.count ?? 0) / activeVolunteerCount) * 100);

        if (availabilityPct < 100) {
          recommendations.push(
            `${100 - availabilityPct}% of your active volunteers haven't submitted availability for ${new Date(focus.date).toLocaleDateString()} yet.`,
          );
        }
      }

      if (focusService && focusService.missingRoles.length > 0) {
        recommendations.push(`Coverage gap: ${focusService.missingRoles.join(", ")} still need${focusService.missingRoles.length === 1 ? "s" : ""} a volunteer.`);
      }
      if (focusService && focusService.coveragePct === null) {
        recommendations.push(`No schedule has been generated yet for "${focusService.title}".`);
      }

      return {
        upcomingServices: upcoming.map((s) => ({ id: s.id, title: s.title, type: s.type, date: s.date })),
        focusService,
        availabilityPct,
        activeVolunteerCount,
        recommendations,
      };
    });
  }
}
