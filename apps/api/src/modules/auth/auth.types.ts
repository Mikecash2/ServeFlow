export type ChurchRole =
  | "CHURCH_ADMIN"
  | "CAMPUS_ADMIN"
  | "MINISTRY_LEADER"
  | "TEAM_LEADER"
  | "VOLUNTEER"
  | "GUEST";

export type GlobalRole = "SYSTEM_OWNER" | "PLATFORM_ADMIN" | "NONE";

export interface MembershipSummary {
  id: string;
  churchId: string;
  campusId: string | null;
  ministryId: string | null;
  role: ChurchRole;
}

/** Attached to `request.user` by JwtAuthGuard on every authenticated request. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  globalRole: GlobalRole;
  memberships: MembershipSummary[];
}

export interface JwtAccessPayload {
  sub: string; // userId
  type: "access";
}

export interface JwtRefreshPayload {
  sub: string;
  type: "refresh";
  tokenId: string;
}
