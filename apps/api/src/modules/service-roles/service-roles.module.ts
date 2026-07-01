import { Module } from "@nestjs/common";
import { ServiceRolesController } from "./service-roles.controller";
import { ServiceRolesRepository } from "./service-roles.repository";
import { ServicesModule } from "../services/services.module";

@Module({
  imports: [ServicesModule],
  controllers: [ServiceRolesController],
  providers: [ServiceRolesRepository],
})
export class ServiceRolesModule {}
