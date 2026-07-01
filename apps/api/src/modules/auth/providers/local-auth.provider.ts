import { ConflictException, Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import { DatabaseService } from "../../../database/database.service";
import { AuthProvider, RegisterInput } from "./auth-provider.interface";

interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
}

@Injectable()
export class LocalAuthProvider implements AuthProvider {
  constructor(private readonly db: DatabaseService) {}

  async registerUser(input: RegisterInput): Promise<{ userId: string }> {
    const existing = await this.db.queryOne<UserRow>(
      "select id, email, password_hash from users where email = $1",
      [input.email.toLowerCase()],
    );
    if (existing) {
      throw new ConflictException({
        error: { code: "CONFLICT", message: "An account with this email already exists" },
      });
    }

    const passwordHash = await argon2.hash(input.password);
    const row = await this.db.queryOne<{ id: string }>(
      `insert into users (email, first_name, last_name, password_hash)
       values ($1, $2, $3, $4) returning id`,
      [input.email.toLowerCase(), input.firstName, input.lastName, passwordHash],
    );
    if (!row) {
      throw new Error("Failed to create user");
    }
    return { userId: row.id };
  }

  async verifyCredentials(email: string, password: string): Promise<{ userId: string } | null> {
    const user = await this.db.queryOne<UserRow>(
      "select id, email, password_hash from users where email = $1",
      [email.toLowerCase()],
    );
    if (!user || !user.password_hash) return null;

    const valid = await argon2.verify(user.password_hash, password).catch(() => false);
    if (!valid) return null;

    return { userId: user.id };
  }
}
