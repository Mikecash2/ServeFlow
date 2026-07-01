import { ArgumentMetadata, BadRequestException, PipeTransform } from "@nestjs/common";
import { ZodSchema } from "zod";

/**
 * Validates request bodies/queries/params against a Zod schema declared per
 * route (see modules/auth/dto for examples). On failure, throws in the
 * standard error envelope shape from docs/03-api-spec.md:
 * { error: { code, message, details } }.
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request failed validation",
          details: result.error.flatten(),
        },
      });
    }
    return result.data;
  }
}
