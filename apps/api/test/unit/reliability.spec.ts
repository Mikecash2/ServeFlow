import { describe, expect, it } from "vitest";
import { computeReliabilityScore } from "../../src/modules/attendance/reliability.types";

describe("computeReliabilityScore", () => {
  it("defaults new volunteers (fewer than 5 data points) to 0.85", () => {
    expect(computeReliabilityScore({ attended: 2, noShows: 0, lateCancellations: 0 })).toBe(0.85);
    expect(computeReliabilityScore({ attended: 0, noShows: 0, lateCancellations: 0 })).toBe(0.85);
  });

  it("scores a perfect attendance record at 1.0", () => {
    expect(computeReliabilityScore({ attended: 10, noShows: 0, lateCancellations: 0 })).toBe(1.0);
  });

  it("penalizes no-shows more than late cancellations", () => {
    const withNoShows = computeReliabilityScore({ attended: 8, noShows: 4, lateCancellations: 0 });
    const withCancellations = computeReliabilityScore({ attended: 8, noShows: 0, lateCancellations: 4 });
    expect(withCancellations).toBeGreaterThan(withNoShows);
  });

  it("floors the score at 0.1 even for a very poor record", () => {
    const score = computeReliabilityScore({ attended: 0, noShows: 20, lateCancellations: 0 });
    expect(score).toBe(0.1);
  });
});
