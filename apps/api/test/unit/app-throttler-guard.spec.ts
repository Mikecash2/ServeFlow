import { afterEach, describe, expect, it, vi } from "vitest";
import { ThrottlerGuard } from "@nestjs/throttler";
import { AppThrottlerGuard } from "../../src/common/guards/app-throttler.guard";

describe("AppThrottlerGuard", () => {
  afterEach(() => {
    delete process.env.DISABLE_RATE_LIMIT;
    vi.restoreAllMocks();
  });

  it("skips throttling entirely when DISABLE_RATE_LIMIT=true (test-suite mode)", async () => {
    process.env.DISABLE_RATE_LIMIT = "true";
    const guard = Object.create(AppThrottlerGuard.prototype) as AppThrottlerGuard;
    const superSpy = vi.spyOn(ThrottlerGuard.prototype, "canActivate");
    const result = await guard.canActivate({} as any);
    expect(result).toBe(true);
    expect(superSpy).not.toHaveBeenCalled();
  });

  it("delegates to the real ThrottlerGuard when the flag is unset", async () => {
    const guard = Object.create(AppThrottlerGuard.prototype) as AppThrottlerGuard;
    const superSpy = vi.spyOn(ThrottlerGuard.prototype, "canActivate").mockResolvedValue(true);
    const result = await guard.canActivate({} as any);
    expect(result).toBe(true);
    expect(superSpy).toHaveBeenCalledOnce();
  });
});
