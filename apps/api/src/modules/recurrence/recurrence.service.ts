import { Injectable, BadRequestException } from "@nestjs/common";
import { RRule } from "rrule";

/**
 * The recurrence-expansion machinery deferred since Phase 2 (availability)
 * and Phase 3 (services) — both `recurrenceRule` columns accepted a raw
 * RFC5545 RRULE string from day one, but nothing expanded it into concrete
 * dates until now. Phase 10 needed real RRULE parsing for the calendar view
 * anyway, so this is built once and reused by both.
 */
@Injectable()
export class RecurrenceService {
  /** Expands an RRULE string anchored at `dtstart` into concrete occurrence dates within [from, to]. */
  expand(rrule: string, dtstart: Date, from: Date, to: Date, maxOccurrences = 52): Date[] {
    let rule: RRule;
    try {
      rule = RRule.fromString(`DTSTART:${this.toRRuleDate(dtstart)}\n${rrule.startsWith("RRULE:") ? rrule : `RRULE:${rrule}`}`);
    } catch (err) {
      throw new BadRequestException({
        error: { code: "VALIDATION_ERROR", message: `Invalid recurrence rule: ${(err as Error).message}` },
      });
    }
    const occurrences = rule.between(from, to, true);
    return occurrences.slice(0, maxOccurrences);
  }

  private toRRuleDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  }
}
