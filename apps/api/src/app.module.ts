import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./database/database.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { CoreDataModule } from "./modules/core-data/core-data.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ChurchesModule } from "./modules/churches/churches.module";
import { CampusesModule } from "./modules/campuses/campuses.module";
import { HealthModule } from "./modules/health/health.module";

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
  ],
})
export class AppModule {}
