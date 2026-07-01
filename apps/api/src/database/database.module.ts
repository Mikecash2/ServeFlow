import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseService } from "./database.service";
import { TenantDbService } from "./tenant-db.service";

// Global module: every feature module gets DatabaseService/TenantDbService
// injected without re-importing this module everywhere.
//
// NOTE ON PRISMA: the long-term architecture (see docs/02-architecture.md)
// specifies Prisma as the ORM. This service uses `pg` directly instead,
// because this development sandbox cannot reach Prisma's engine-binary CDN
// (binaries.prisma.sh is not on the network allowlist here), so the Prisma
// CLI/runtime cannot function in this environment. `packages/db/prisma/schema.prisma`
// remains the authoritative schema. On a machine with normal network access,
// this module should be replaced with a PrismaService wrapping PrismaClient —
// the repository classes in each feature module expose the same methods
// either way, so call sites do not change.
@Global()
@Module({
  imports: [ConfigModule],
  providers: [DatabaseService, TenantDbService],
  exports: [DatabaseService, TenantDbService],
})
export class DatabaseModule {}
