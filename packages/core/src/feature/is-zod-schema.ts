import type { ZodSchema } from "zod";

export function isZodSchema(value: unknown): value is ZodSchema {
  if (typeof value !== "object" || value === null || !("~standard" in value)) {
    return false;
  }

  const standard = (value as { "~standard"?: { vendor?: unknown } })["~standard"];
  return standard?.vendor === "zod";
}
