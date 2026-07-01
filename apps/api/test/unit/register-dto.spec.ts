import { describe, expect, it } from "vitest";
import { registerSchema } from "../../src/modules/auth/dto/register.dto";

describe("registerSchema", () => {
  const valid = {
    email: "leader@example.com",
    password: "GoodPassword1",
    firstName: "Jane",
    lastName: "Doe",
    churchName: "Grace Chapel",
  };

  it("accepts a valid payload", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a password under 10 characters", () => {
    const result = registerSchema.safeParse({ ...valid, password: "Short1" });
    expect(result.success).toBe(false);
  });

  it("rejects a password with no uppercase letter", () => {
    const result = registerSchema.safeParse({ ...valid, password: "lowercase123" });
    expect(result.success).toBe(false);
  });

  it("rejects a password with no digit", () => {
    const result = registerSchema.safeParse({ ...valid, password: "NoDigitsHere" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = registerSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing churchName", () => {
    const { churchName, ...rest } = valid;
    const result = registerSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});
