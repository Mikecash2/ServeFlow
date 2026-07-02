import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../../common/decorators/public.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AuthService } from "./auth.service";
import { registerSchema, RegisterDto } from "./dto/register.dto";
import { loginSchema, LoginDto } from "./dto/login.dto";
import { refreshSchema, RefreshDto } from "./dto/refresh.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Tighter than the global 120/min default: brute-force protection on the
  // two endpoints that accept a password (docs/08-roadmap.md Phase 11).
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("register")
  async register(@Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Body(new ZodValidationPipe(refreshSchema)) dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Body(new ZodValidationPipe(refreshSchema)) dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
    return { success: true };
  }
}
