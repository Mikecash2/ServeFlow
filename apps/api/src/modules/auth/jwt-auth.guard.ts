import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { IS_PUBLIC_KEY } from "../../common/decorators/public.decorator";
import { AuthService } from "./auth.service";
import { JwtAccessPayload } from "./auth.types";

/**
 * Verifies the access token and attaches the resolved AuthenticatedUser
 * (including memberships, needed by PermissionGuard) to request.user.
 * Registered globally (APP_GUARD in auth.module.ts) so every route is
 * protected by default; routes are opted OUT with @Public(), not opted in —
 * this is deliberate so a forgotten decorator fails closed, not open.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers["authorization"];
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException({
        error: { code: "UNAUTHORIZED", message: "Missing bearer token" },
      });
    }

    const token = authHeader.slice("Bearer ".length);
    let payload: JwtAccessPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtAccessPayload>(token, {
        secret: this.config.get<string>("JWT_ACCESS_SECRET"),
      });
    } catch {
      throw new UnauthorizedException({
        error: { code: "UNAUTHORIZED", message: "Invalid or expired access token" },
      });
    }

    if (payload.type !== "access") {
      throw new UnauthorizedException({
        error: { code: "UNAUTHORIZED", message: "Token is not an access token" },
      });
    }

    const user = await this.authService.loadAuthenticatedUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException({
        error: { code: "UNAUTHORIZED", message: "User no longer exists" },
      });
    }

    request.user = user;
    return true;
  }
}
