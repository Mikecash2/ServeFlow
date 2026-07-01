import { Global, Module } from "@nestjs/common";
import { MembershipsRepository } from "./memberships.repository";
import { PermissionsRepository } from "./permissions.repository";
import { PermissionGuard } from "./permission.guard";

@Global()
@Module({
  providers: [MembershipsRepository, PermissionsRepository, PermissionGuard],
  exports: [MembershipsRepository, PermissionsRepository, PermissionGuard],
})
export class RbacModule {}
