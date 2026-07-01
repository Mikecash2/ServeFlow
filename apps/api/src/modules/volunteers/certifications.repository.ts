import { Injectable } from "@nestjs/common";
import { TenantDbService } from "../../database/tenant-db.service";

export interface CertificationRecord {
  id: string;
  name: string;
  issuedAt: string | null;
  expiresAt: string | null;
  documentUrl: string | null;
}

@Injectable()
export class CertificationsRepository {
  constructor(private readonly tenantDb: TenantDbService) {}

  async add(params: {
    churchId: string;
    volunteerProfileId: string;
    name: string;
    issuedAt?: string;
    expiresAt?: string;
    documentUrl?: string;
  }): Promise<CertificationRecord> {
    return this.tenantDb.runInTenantContext(params.churchId, async (query) => {
      const rows = await query<{
        id: string; name: string; issued_at: string | null; expires_at: string | null; document_url: string | null;
      }>(
        `insert into certifications (volunteer_profile_id, name, issued_at, expires_at, document_url)
         values ($1, $2, $3, $4, $5)
         returning id, name, issued_at, expires_at, document_url`,
        [params.volunteerProfileId, params.name, params.issuedAt ?? null, params.expiresAt ?? null, params.documentUrl ?? null],
      );
      const r = rows[0];
      return { id: r.id, name: r.name, issuedAt: r.issued_at, expiresAt: r.expires_at, documentUrl: r.document_url };
    });
  }

  async listForVolunteer(churchId: string, volunteerProfileId: string): Promise<CertificationRecord[]> {
    return this.tenantDb.runInTenantContext(churchId, async (query) => {
      const rows = await query<{
        id: string; name: string; issued_at: string | null; expires_at: string | null; document_url: string | null;
      }>(
        `select id, name, issued_at, expires_at, document_url from certifications
         where volunteer_profile_id = $1 order by name asc`,
        [volunteerProfileId],
      );
      return rows.map((r) => ({ id: r.id, name: r.name, issuedAt: r.issued_at, expiresAt: r.expires_at, documentUrl: r.document_url }));
    });
  }
}
