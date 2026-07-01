import { describe, expect, it, vi } from "vitest";
import { ScoringService } from "../../src/modules/scheduling/scoring.service";
import { CandidateRow } from "../../src/modules/scheduling/scheduling.types";

function makeCandidate(overrides: Partial<CandidateRow> & { volunteerProfileId: string }): CandidateRow {
  return {
    firstName: "First",
    lastName: "Last",
    reliabilityScore: 1.0,
    preferredRoleNames: [],
    ...overrides,
  };
}

describe("ScoringService", () => {
  it("weights sum to 1.0 so a perfect-on-every-factor candidate scores 1.0", async () => {
    const candidatesRepo = {
      getSkillMatch: vi.fn().mockResolvedValue(1.0),
      getTrailingAssignmentCount: vi.fn().mockResolvedValue(0),
    } as any;
    const scoring = new ScoringService(candidatesRepo);

    const candidate = makeCandidate({ volunteerProfileId: "v1", reliabilityScore: 1.0, preferredRoleNames: ["Camera 2"] });
    const [result] = await scoring.scoreCandidates({
      churchId: "church-1",
      serviceRoleId: "role-1",
      roleName: "Camera 2",
      serviceDate: "2026-07-12",
      candidates: [candidate],
    });

    expect(result.finalScore).toBeCloseTo(1.0, 5);
  });

  it("gives a preference-match candidate a higher score than an otherwise-identical non-match", async () => {
    const candidatesRepo = {
      getSkillMatch: vi.fn().mockResolvedValue(1.0),
      getTrailingAssignmentCount: vi.fn().mockResolvedValue(0),
    } as any;
    const scoring = new ScoringService(candidatesRepo);

    const preferring = makeCandidate({ volunteerProfileId: "v1", preferredRoleNames: ["Camera 2"] });
    const notPreferring = makeCandidate({ volunteerProfileId: "v2", preferredRoleNames: [] });

    const results = await scoring.scoreCandidates({
      churchId: "church-1",
      serviceRoleId: "role-1",
      roleName: "Camera 2",
      serviceDate: "2026-07-12",
      candidates: [preferring, notPreferring],
    });

    const scoreFor = (id: string) => results.find((r) => r.volunteerProfileId === id)!.finalScore;
    expect(scoreFor("v1")).toBeGreaterThan(scoreFor("v2"));
  });

  it("penalizes a candidate who served within the trailing 7 days (fatigue)", async () => {
    const candidatesRepo = {
      getSkillMatch: vi.fn().mockResolvedValue(1.0),
      getTrailingAssignmentCount: vi.fn((_churchId: string, volunteerProfileId: string, _date: string, days: number) => {
        if (days === 7) return Promise.resolve(volunteerProfileId === "tired" ? 1 : 0);
        return Promise.resolve(0);
      }),
    } as any;
    const scoring = new ScoringService(candidatesRepo);

    const tired = makeCandidate({ volunteerProfileId: "tired" });
    const fresh = makeCandidate({ volunteerProfileId: "fresh" });

    const results = await scoring.scoreCandidates({
      churchId: "church-1",
      serviceRoleId: "role-1",
      roleName: "Camera 2",
      serviceDate: "2026-07-12",
      candidates: [tired, fresh],
    });

    const scoreFor = (id: string) => results.find((r) => r.volunteerProfileId === id)!.finalScore;
    expect(scoreFor("fresh")).toBeGreaterThan(scoreFor("tired"));
  });

  it("pulls a less-recently-used volunteer's workloadBalance score up relative to a heavily-used one", async () => {
    const candidatesRepo = {
      getSkillMatch: vi.fn().mockResolvedValue(1.0),
      getTrailingAssignmentCount: vi.fn((_churchId: string, volunteerProfileId: string, _date: string, days: number) => {
        if (days === 56) return Promise.resolve(volunteerProfileId === "busy" ? 6 : 0);
        return Promise.resolve(0);
      }),
    } as any;
    const scoring = new ScoringService(candidatesRepo);

    const busy = makeCandidate({ volunteerProfileId: "busy" });
    const idle = makeCandidate({ volunteerProfileId: "idle" });

    const results = await scoring.scoreCandidates({
      churchId: "church-1",
      serviceRoleId: "role-1",
      roleName: "Camera 2",
      serviceDate: "2026-07-12",
      candidates: [busy, idle],
    });

    const scoreFor = (id: string) => results.find((r) => r.volunteerProfileId === id)!.finalScore;
    expect(scoreFor("idle")).toBeGreaterThan(scoreFor("busy"));
  });
});
