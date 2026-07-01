import { Injectable } from "@nestjs/common";
import { createEvents, EventAttributes, DateArray } from "ics";
import { ServicesRepository } from "../services/services.repository";

function toDateArray(iso: string): DateArray {
  const d = new Date(iso);
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()];
}

@Injectable()
export class CalendarService {
  constructor(private readonly services: ServicesRepository) {}

  /**
   * ICS export (docs/08-roadmap.md Phase 10 exit criteria): a feed of every
   * service, one year back to one year forward, importable into
   * Google/Outlook/Apple Calendar. Uses `startInputType/startOutputType:
   * "utc"` throughout since every timestamp in the database is already UTC
   * (Postgres `timestamptz`) — no local-timezone ambiguity to resolve.
   */
  async generateIcsFeed(churchId: string, churchName: string): Promise<string> {
    const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const services = await this.services.listForChurch(churchId, from, to);

    const events: EventAttributes[] = services.map((s) => ({
      uid: `service-${s.id}@serveflow.app`,
      title: s.title,
      description: s.notes ?? undefined,
      location: s.venue ?? undefined,
      start: toDateArray(s.serviceStart),
      startInputType: "utc",
      startOutputType: "utc",
      end: toDateArray(s.serviceEnd ?? s.serviceStart),
      endInputType: "utc",
      endOutputType: "utc",
      calName: churchName,
      status: "CONFIRMED",
    }));

    const result = createEvents(events);
    if (result.error) throw result.error;
    return result.value ?? "";
  }
}
