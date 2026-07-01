import { Global, Module } from "@nestjs/common";
import { ChurchesRepository } from "./churches.repository";
import { CampusesRepository } from "./campuses.repository";

@Global()
@Module({
  providers: [ChurchesRepository, CampusesRepository],
  exports: [ChurchesRepository, CampusesRepository],
})
export class CoreDataModule {}
