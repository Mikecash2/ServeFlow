import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { randomBytes, randomUUID } from "crypto";
import { AUTH_PROVIDER, AuthProvider } from "./providers/auth-provider.interface";
import { UsersRepository } from "./users.repository";
import { RefreshTokensRepository } from "./refresh-tokens.repository";
import { MembershipsRepository } from "../rbac/memberships.repository";
import { ChurchesRepository } from "../core-data/churches.repository";
import { CampusesRepository } from "../core-data/campuses.repository";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { AuthenticatedUser, JwtAccessPayload } from "./auth.types";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${base}-${randomBytes(3).toString("hex")}`;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_PROVIDER) private readonly authProvider: AuthProvider,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly users: UsersRepository,
    private readonly refreshTokens: RefreshTokensRepository,
    private readonly memberships: MembershipsRepository,
    private readonly churches: ChurchesRepository,
    private readonly campuses: CampusesRepository,
  ) {}

  /**
   * Church onboarding (docs/05-user-flows.md §1): creates the user, a new
   * church, its first campus, and a CHURCH_ADMIN membership tying them
   * together — all in one call so the caller lands with a fully-usable
   * account, not a dangling user with nowhere to go.
   */
  async register(dto: RegisterDto): Promise<{ user: AuthenticatedUser } & TokenPair> {
    const { userId } = await this.authProvider.registerUser({
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });

    const church = await this.churches.create({
      name: dto.churchName,
      slug: slugify(dto.churchName),
      timezone: dto.timezone,
    });

    await this.campuses.create({ churchId: church.id, name: "Main Campus", isPrimary: true });
    await this.memberships.createChurchAdmin({ userId, churchId: church.id });

    return this.issueSession(userId);
  }

  async login(dto: LoginDto): Promise<{ user: AuthenticatedUser } & TokenPair> {
    const result = await this.authProvider.verifyCredentials(dto.email, dto.password);
    if (!result) {
      throw new UnauthorizedException({
        error: { code: "UNAUTHORIZED", message: "Invalid email or password" },
      });
    }
    return this.issueSession(result.userId);
  }

  async refresh(refreshTokenValue: string): Promise<TokenPair> {
    const [tokenId, secret] = refreshTokenValue.split(".");
    if (!tokenId || !secret) {
      throw new UnauthorizedException({
        error: { code: "UNAUTHORIZED", message: "Malformed refresh token" },
      });
    }

    const record = await this.refreshTokens.findValid(tokenId, refreshTokenValue);
    if (!record) {
      throw new UnauthorizedException({
        error: { code: "UNAUTHORIZED", message: "Refresh token is invalid or expired" },
      });
    }

    // Rotate: revoke the used token and issue a brand new pair. This limits
    // the blast radius of a leaked refresh token to a single use.
    await this.refreshTokens.revoke(tokenId);
    const session = await this.issueSession(record.userId);
    return { accessToken: session.accessToken, refreshToken: session.refreshToken, expiresIn: session.expiresIn };
  }

  async logout(refreshTokenValue: string): Promise<void> {
    const [tokenId] = refreshTokenValue.split(".");
    if (tokenId) await this.refreshTokens.revoke(tokenId);
  }

  async loadAuthenticatedUser(userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.users.findById(userId);
    if (!user) return null;
    const memberships = await this.memberships.findActiveByUserIdUnscoped(userId);
    return { ...user, memberships };
  }

  private async issueSession(userId: string): Promise<{ user: AuthenticatedUser } & TokenPair> {
    const user = await this.loadAuthenticatedUser(userId);
    if (!user) throw new UnauthorizedException({ error: { code: "UNAUTHORIZED", message: "User not found" } });

    const accessTtl = this.config.get<string>("JWT_ACCESS_TTL", "15m");
    const accessPayload: JwtAccessPayload = { sub: userId, type: "access" };
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get<string>("JWT_ACCESS_SECRET"),
      expiresIn: accessTtl,
    });

    const tokenId = randomUUID();
    const secret = randomBytes(32).toString("hex");
    const refreshToken = `${tokenId}.${secret}`;
    const refreshTtlDays = 30;
    await this.refreshTokens.create({
      id: tokenId,
      userId,
      token: refreshToken,
      expiresAt: new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000),
    });

    return { user, accessToken, refreshToken, expiresIn: accessTtl };
  }
}
