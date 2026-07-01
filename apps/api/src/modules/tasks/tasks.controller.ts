import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { TasksRepository, TaskPhase } from "./tasks.repository";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { ServicesRepository } from "../services/services.repository";
import { createTaskSchema, CreateTaskDto } from "./dto/create-task.dto";
import { updateTaskStatusSchema, UpdateTaskStatusDto } from "./dto/update-task-status.dto";
import { addPhotoSchema, AddPhotoDto } from "./dto/add-photo.dto";

@Controller("churches/:churchId/services/:serviceId/tasks")
@UseGuards(PermissionGuard)
export class TasksController {
  constructor(
    private readonly tasks: TasksRepository,
    private readonly services: ServicesRepository,
    private readonly realtime: RealtimeGateway,
  ) {}

  private async assertServiceExists(churchId: string, serviceId: string) {
    const service = await this.services.findById(churchId, serviceId);
    if (!service) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Service not found" } });
    }
  }

  private async assertTaskExists(churchId: string, serviceId: string, taskId: string) {
    const task = await this.tasks.findById(churchId, serviceId, taskId);
    if (!task) {
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Task not found" } });
    }
    return task;
  }

  @Get()
  @RequirePermission({ resource: "task", action: "read" })
  async list(
    @Param("churchId") churchId: string,
    @Param("serviceId") serviceId: string,
    @Query("phase") phase?: TaskPhase,
  ) {
    await this.assertServiceExists(churchId, serviceId);
    return this.tasks.listForService(churchId, serviceId, phase);
  }

  @Post()
  @RequirePermission({ resource: "task", action: "write" })
  async create(
    @Param("churchId") churchId: string,
    @Param("serviceId") serviceId: string,
    @Body(new ZodValidationPipe(createTaskSchema)) dto: CreateTaskDto,
  ) {
    await this.assertServiceExists(churchId, serviceId);
    if (dto.dependsOnTaskId) {
      await this.assertTaskExists(churchId, serviceId, dto.dependsOnTaskId);
    }
    return this.tasks.create({ churchId, serviceId, ...dto });
  }

  @Patch(":taskId")
  @RequirePermission({ resource: "task", action: "write" })
  async updateStatus(
    @Param("churchId") churchId: string,
    @Param("serviceId") serviceId: string,
    @Param("taskId") taskId: string,
    @Body(new ZodValidationPipe(updateTaskStatusSchema)) dto: UpdateTaskStatusDto,
  ) {
    await this.assertTaskExists(churchId, serviceId, taskId);
    const updated = await this.tasks.updateStatus(churchId, taskId, dto.status, dto.assignedVolunteerId);
    this.realtime.emitTaskUpdated(churchId, updated);
    return updated;
  }

  @Post(":taskId/photos")
  @RequirePermission({ resource: "task", action: "write" })
  async addPhoto(
    @Param("churchId") churchId: string,
    @Param("serviceId") serviceId: string,
    @Param("taskId") taskId: string,
    @Body(new ZodValidationPipe(addPhotoSchema)) dto: AddPhotoDto,
  ) {
    await this.assertTaskExists(churchId, serviceId, taskId);
    return this.tasks.addPhoto(churchId, taskId, dto.photoUrl);
  }
}
