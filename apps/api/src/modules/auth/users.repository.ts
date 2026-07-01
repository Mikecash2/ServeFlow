import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { GlobalRole } from "./auth.types";

export interface UserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  globalRole: GlobalRole;
}

interface UserRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  global_role: GlobalRole;
}

function toRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    globalRole: row.global_role,
  };
}

@Injectable()
export class UsersRepository {
  constructor(private readonly db: DatabaseService) {}

  async findById(id: string): Promise<UserRecord | null> {
    const row = await this.db.queryOne<UserRow>(
      `select id, email, first_name, last_name, global_role from users where id = $1`,
      [id],
    );
    return row ? toRecord(row) : null;
  }
}
