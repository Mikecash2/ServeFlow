import { Injectable } from "@nestjs/common";
import { TenantDbService } from "../../database/tenant-db.service";

export type ChecklistKind = "SETUP" | "SERVICE" | "EMERGENCY" | "SHUTDOWN" | "DERIG";

export interface ChecklistTemplateRecord {
  id: string;
  churchId: string;
  kind: ChecklistKind;
  name: string;
}

export interface ChecklistTemplateItemRecord {
  id: string;
  templateId: string;
  label: string;
  sortOrder: number;
  isRequired: boolean;
}

export interface CompletedItemEntry {
  completedBy: string;
  completedAt: string;
  note?: string;
  photoUrl?: string;
}

export interface ChecklistInstanceRecord {
  id: string;
  templateId: string;
  serviceId: string;
  completedItems: Record<string, CompletedItemEntry>;
}

@Injectable()
export class ChecklistsRepository {
  constructor(private readonly tenantDb: TenantDbService) {}

  async createTemplate(params: { churchId: string; kind: ChecklistKind; name: string }): Promise<ChecklistTemplateRecord> {
    return this.tenantDb.runInTenantContext(params.churchId, async (query) => {
      const rows = await query<{ id: string; church_id: string; kind: ChecklistKind; name: string }>(
        `insert into checklist_templates (church_id, kind, name) values ($1, $2, $3)
         returning id, church_id, kind, name`,
        [params.churchId, params.kind, params.name],
      );
      const r = rows[0];
      return { id: r.id, churchId: r.church_id, kind: r.kind, name: r.name };
    });
  }

  async listTemplates(churchId: string, kind?: ChecklistKind): Promise<ChecklistTemplateRecord[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<{ id: string; church_id: string; kind: ChecklistKind; name: string }>(
        `select id, church_id, kind, name from checklist_templates
         where church_id = $1 and ($2::text is null or kind = $2::checklist_kind) order by name asc`,
        [churchId, kind ?? null],
      );
      return rows.map((r) => ({ id: r.id, churchId: r.church_id, kind: r.kind, name: r.name }));
    });
  }

  async findTemplateById(churchId: string, templateId: string): Promise<ChecklistTemplateRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<{ id: string; church_id: string; kind: ChecklistKind; name: string }>(
        `select id, church_id, kind, name from checklist_templates where id = $1 and church_id = $2`,
        [templateId, churchId],
      );
      return rows[0] ? { id: rows[0].id, churchId: rows[0].church_id, kind: rows[0].kind, name: rows[0].name } : null;
    });
  }

  async addItem(params: {
    churchId: string; templateId: string; label: string; sortOrder?: number; isRequired?: boolean;
  }): Promise<ChecklistTemplateItemRecord> {
    return this.tenantDb.runInTenantContext(params.churchId, async (query) => {
      const rows = await query<{ id: string; template_id: string; label: string; sort_order: number; is_required: boolean }>(
        `insert into checklist_template_items (template_id, label, sort_order, is_required)
         values ($1, $2, $3, $4)
         returning id, template_id, label, sort_order, is_required`,
        [params.templateId, params.label, params.sortOrder ?? 0, params.isRequired ?? true],
      );
      const r = rows[0];
      return { id: r.id, templateId: r.template_id, label: r.label, sortOrder: r.sort_order, isRequired: r.is_required };
    });
  }

  async listItems(churchId: string, templateId: string): Promise<ChecklistTemplateItemRecord[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<{ id: string; template_id: string; label: string; sort_order: number; is_required: boolean }>(
        `select id, template_id, label, sort_order, is_required from checklist_template_items
         where template_id = $1 order by sort_order asc`,
        [templateId],
      );
      return rows.map((r) => ({ id: r.id, templateId: r.template_id, label: r.label, sortOrder: r.sort_order, isRequired: r.is_required }));
    });
  }

  async instantiate(params: { churchId: string; serviceId: string; templateId: string }): Promise<ChecklistInstanceRecord> {
    return this.tenantDb.runInTenantContext(params.churchId, async (query) => {
      const rows = await query<{ id: string; template_id: string; service_id: string; completed_items: Record<string, CompletedItemEntry> }>(
        `insert into checklist_instances (template_id, service_id) values ($1, $2)
         returning id, template_id, service_id, completed_items`,
        [params.templateId, params.serviceId],
      );
      const r = rows[0];
      return { id: r.id, templateId: r.template_id, serviceId: r.service_id, completedItems: r.completed_items };
    });
  }

  async listInstancesForService(churchId: string, serviceId: string): Promise<ChecklistInstanceRecord[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<{ id: string; template_id: string; service_id: string; completed_items: Record<string, CompletedItemEntry> }>(
        `select id, template_id, service_id, completed_items from checklist_instances where service_id = $1`,
        [serviceId],
      );
      return rows.map((r) => ({ id: r.id, templateId: r.template_id, serviceId: r.service_id, completedItems: r.completed_items }));
    });
  }

  async findInstanceById(churchId: string, serviceId: string, instanceId: string): Promise<ChecklistInstanceRecord | null> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<{ id: string; template_id: string; service_id: string; completed_items: Record<string, CompletedItemEntry> }>(
        `select id, template_id, service_id, completed_items from checklist_instances where id = $1 and service_id = $2`,
        [instanceId, serviceId],
      );
      return rows[0]
        ? { id: rows[0].id, templateId: rows[0].template_id, serviceId: rows[0].service_id, completedItems: rows[0].completed_items }
        : null;
    });
  }

  async completeItem(params: {
    churchId: string; instanceId: string; itemId: string; completedBy: string; note?: string; photoUrl?: string;
  }): Promise<ChecklistInstanceRecord | null> {
    return this.tenantDb.runInTenantContext(params.churchId, async (query) => {
      const entry: CompletedItemEntry = {
        completedBy: params.completedBy,
        completedAt: new Date().toISOString(),
        ...(params.note ? { note: params.note } : {}),
        ...(params.photoUrl ? { photoUrl: params.photoUrl } : {}),
      };
      const rows = await query<{ id: string; template_id: string; service_id: string; completed_items: Record<string, CompletedItemEntry> }>(
        `update checklist_instances
         set completed_items = completed_items || jsonb_build_object($2::text, $3::jsonb)
         where id = $1
         returning id, template_id, service_id, completed_items`,
        [params.instanceId, params.itemId, JSON.stringify(entry)],
      );
      return rows[0]
        ? { id: rows[0].id, templateId: rows[0].template_id, serviceId: rows[0].service_id, completedItems: rows[0].completed_items }
        : null;
    });
  }
}
