import { Module } from "@nestjs/common";
import { VolunteersController } from "./volunteers.controller";
import { VolunteersRepository } from "./volunteers.repository";
import { SkillsRepository } from "./skills.repository";
import { CertificationsRepository } from "./certifications.repository";
import { TrainingRecordsRepository } from "./training-records.repository";

@Module({
  controllers: [VolunteersController],
  providers: [VolunteersRepository, SkillsRepository, CertificationsRepository, TrainingRecordsRepository],
  exports: [VolunteersRepository],
})
export class VolunteersModule {}
