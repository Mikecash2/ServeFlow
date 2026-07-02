import { ExecutionContext, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * Rate limiting is real (see docs/08-roadmap.md Phase 11) but gets out of
 * the way during automated tests: the integration suite legitimately calls
 * /auth/register dozens of times across test files within the same
 * process/IP, which would otherwise trip the intentionally-tight
 * brute-force limits on that endpoint. `DISABLE_RATE_LIMIT=true` is set
 * only in `npm run test:integration`, never in a real deployment.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.DISABLE_RATE_LIMIT === "true") return true;
    return super.canActivate(context);
  }
}
