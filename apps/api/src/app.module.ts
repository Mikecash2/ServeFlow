import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./database/database.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { CoreDataModule } from "./modules/core-data/core-data.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ChurchesModule } from "./modules/churches/churches.module";
import { CampusesModule } from "./modules/campuses/campuses.module";
import { HealthModule } from "./modules/health/health.module";
import { MinistriesModule } from "./modules/ministries/ministries.module";
import { TeamsModule } from "./modules/teams/teams.module";
import { VolunteersModule } from "./modules/volunteers/volunteers.module";
import { AvailabilityModule } from "./modules/availability/availability.module";
import { ServicesModule } from "./modules/services/services.module";
import { ServiceRolesModule } from "./modules/service-roles/service-roles.module";
import { TasksModule } from "./modules/tasks/tasks.module";
import { ChecklistsModule } from "./modules/checklists/checklists.module";
import { SchedulingModule } from "./modules/scheduling/scheduling.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RbacModule,
    CoreDataModule,
    AuthModule,
    ChurchesModule,
    CampusesModule,
    HealthModule,
    MinistriesModule,
    TeamsModule,
    VolunteersModule,
    AvailabilityModule,
    ServicesModule,
    ServiceRolesModule,
    TasksModule,
    ChecklistsModule,
    SchedulingModule,
    DashboardModule,
    RealtimeModule,
  ],
})
export class AppModule {}
