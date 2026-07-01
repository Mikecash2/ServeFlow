import { describe, expect, it } from "vitest";
import { RecurrenceService } from "../../src/modules/recurrence/recurrence.service";

describe("RecurrenceService", () => {
  const recurrence = new RecurrenceService();

  it("expands a weekly rule into the expected occurrence dates", () => {
    const dtstart = new Date("2026-07-05T09:00:00.000Z");
    const from = dtstart;
    const to = new Date("2026-08-02T09:00:00.000Z"); // dtstart + 28 days
    const occurrences = recurrence.expand("FREQ=WEEKLY", dtstart, from, to);
    expect(occurrences).toHaveLength(5); // day 0, 7, 14, 21, 28
    expect(occurrences[0].toISOString()).toBe(dtstart.toISOString());
    expect(occurrences[1].getTime() - occurrences[0].getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("caps output at maxOccurrences even if the range would produce more", () => {
    const dtstart = new Date("2026-01-01T09:00:00.000Z");
    const from = dtstart;
    const to = new Date("2026-12-31T09:00:00.000Z");
    const occurrences = recurrence.expand("FREQ=WEEKLY", dtstart, from, to, 3);
    expect(occurrences).toHaveLength(3);
  });

  it("throws a validation error for a malformed rule", () => {
    const dtstart = new Date("2026-07-05T09:00:00.000Z");
    expect(() => recurrence.expand("NOT_A_VALID_RULE", dtstart, dtstart, dtstart)).toThrow();
  });
});
