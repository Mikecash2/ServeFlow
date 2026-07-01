import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { UsersRepository } from "./users.repository";
import { RefreshTokensRepository } from "./refresh-tokens.repository";
import { AUTH_PROVIDER } from "./providers/auth-provider.interface";
import { LocalAuthProvider } from "./providers/local-auth.provider";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    UsersRepository,
    RefreshTokensRepository,
    { provide: AUTH_PROVIDER, useClass: LocalAuthProvider },
    // Global guard: every route requires a valid access token unless
    // decorated with @Public(). PermissionGuard (rbac module) is applied
    // per-route on top of this for authorization, not authentication.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
