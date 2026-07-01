import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { VolunteersRepository, VolunteerStatus } from "./volunteers.repository";
import { SkillsRepository } from "./skills.repository";
import { CertificationsRepository } from "./certifications.repository";
import { TrainingRecordsRepository } from "./training-records.repository";
import { inviteVolunteerSchema, InviteVolunteerDto } from "./dto/invite-volunteer.dto";
import { updateVolunteerSchema, UpdateVolunteerDto } from "./dto/update-volunteer.dto";
import { updateStatusSchema, UpdateStatusDto } from "./dto/update-status.dto";
import { addSkillSchema, AddSkillDto } from "./dto/add-skill.dto";
import { addCertificationSchema, AddCertificationDto } from "./dto/add-certification.dto";
import { addTrainingSchema, AddTrainingDto } from "./dto/add-training.dto";

@Controller("churches/:churchId/volunteers")
@UseGuards(PermissionGuard)
export class VolunteersController {
  constructor(
    private readonly volunteers: VolunteersRepository,
    private readonly skills: SkillsRepository,
    private readonly certifications: CertificationsRepository,
    private readonly training: TrainingRecordsRepository,
  ) {}

  private async assertExists(churchId: string, volunteerId: string) {
    const profile = await this.volunteers.findById(churchId, volunteerId);
    if (!profile) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Volunteer not found" } });
    }
    return profile;
  }

  @Get()
  @RequirePermission({ resource: "volunteer", action: "read" })
  async list(@Param("churchId") churchId: string, @Query("status") status?: VolunteerStatus) {
    return this.volunteers.listForChurch(churchId, status);
  }

  @Post()
  @RequirePermission({ resource: "volunteer", action: "write" })
  async invite(
    @Param("churchId") churchId: string,
    @Body(new ZodValidationPipe(inviteVolunteerSchema)) dto: InviteVolunteerDto,
  ) {
    return this.volunteers.inviteVolunteer({ churchId, ...dto });
  }

  @Get(":volunteerId")
  @RequirePermission({ resource: "volunteer", action: "read" })
  async getOne(@Param("churchId") churchId: string, @Param("volunteerId") volunteerId: string) {
    const profile = await this.assertExists(churchId, volunteerId);
    const [skills, certifications, trainingRecords] = await Promise.all([
      this.skills.listForVolunteer(churchId, volunteerId),
      this.certifications.listForVolunteer(churchId, volunteerId),
      this.training.listForVolunteer(churchId, volunteerId),
    ]);
    return { ...profile, skills, certifications, trainingRecords };
  }

  @Patch(":volunteerId")
  @RequirePermission({ resource: "volunteer", action: "write" })
  async update(
    @Param("churchId") churchId: string,
    @Param("volunteerId") volunteerId: string,
    @Body(new ZodValidationPipe(updateVolunteerSchema)) dto: UpdateVolunteerDto,
  ) {
    await this.assertExists(churchId, volunteerId);
    return this.volunteers.updateProfile(churchId, volunteerId, dto);
  }

  @Patch(":volunteerId/status")
  @RequirePermission({ resource: "volunteer", action: "write" })
  async updateStatus(
    @Param("churchId") churchId: string,
    @Param("volunteerId") volunteerId: string,
    @Body(new ZodValidationPipe(updateStatusSchema)) dto: UpdateStatusDto,
  ) {
    await this.assertExists(churchId, volunteerId);
    return this.volunteers.updateStatus(churchId, volunteerId, dto.status);
  }

  @Post(":volunteerId/skills")
  @RequirePermission({ resource: "volunteer", action: "write" })
  async addSkill(
    @Param("churchId") churchId: string,
    @Param("volunteerId") volunteerId: string,
    @Body(new ZodValidationPipe(addSkillSchema)) dto: AddSkillDto,
  ) {
    await this.assertExists(churchId, volunteerId);
    return this.skills.addSkillToVolunteer({ churchId, volunteerProfileId: volunteerId, ...dto });
  }

  @Post(":volunteerId/certifications")
  @RequirePermission({ resource: "volunteer", action: "write" })
  async addCertification(
    @Param("churchId") churchId: string,
    @Param("volunteerId") volunteerId: string,
    @Body(new ZodValidationPipe(addCertificationSchema)) dto: AddCertificationDto,
  ) {
    await this.assertExists(churchId, volunteerId);
    return this.certifications.add({ churchId, volunteerProfileId: volunteerId, ...dto });
  }

  @Post(":volunteerId/training")
  @RequirePermission({ resource: "volunteer", action: "write" })
  async addTraining(
    @Param("churchId") churchId: string,
    @Param("volunteerId") volunteerId: string,
    @Body(new ZodValidationPipe(addTrainingSchema)) dto: AddTrainingDto,
  ) {
    await this.assertExists(churchId, volunteerId);
    return this.training.add({ churchId, volunteerProfileId: volunteerId, ...dto });
  }
}
