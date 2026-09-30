import { ZodError } from "zod";
// Reasons shown in logs. Never echo raw messages from JSON.parse or response
// bodies, which can contain private text.
export function describeError(error: unknown): string {
  if (error instanceof ZodError)
    return error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
  if (error instanceof SyntaxError) return "Malformed JSON";
  if (error instanceof Error) return error.message;
  return "Unknown error";
}
