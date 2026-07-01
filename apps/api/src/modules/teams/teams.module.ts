import { Module } from "@nestjs/common";
import { TeamsController } from "./teams.controller";
import { TeamsRepository } from "./teams.repository";
import { MinistriesModule } from "../ministries/ministries.module";

@Module({
  imports: [MinistriesModule],
  controllers: [TeamsController],
  providers: [TeamsRepository],
})
export class TeamsModule {}
