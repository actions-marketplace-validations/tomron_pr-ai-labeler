import { z } from "zod";
import { parseDocument } from "yaml";
const label = z
  .object({
    name: z.string().trim().min(1).max(50),
    description: z.string().trim().min(1).max(100),
    instructions: z.string().max(4000).default(""),
    color: z
      .string()
      .regex(/^[0-9a-fA-F]{6}$/)
      .default("ededed"),
    threshold: z.number().gt(0.5).max(1).optional(),
  })
  .strict();
export const configSchema = z
  .object({
    endpoint: z
      .string()
      .url()
      .refine((value) => {
        const url = new URL(value);
        return (
          url.protocol === "https:" &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash
        );
      }, "Endpoint must use HTTPS, no credentials, query or fragment")
      .default("https://api.typesafe.ai/v1/systemone"),
    model: z.string().min(1).max(100).default("jev-latest"),
    instructions: z
      .string()
      .max(8000)
      .default("Classify the purpose of this pull request."),
    threshold: z.number().gt(0.5).max(1).default(0.8),
    context: z
      .array(z.enum(["title", "body", "diff", "repo-tree", "repo-files"]))
      .min(1)
      .default(["title", "body", "diff"]),
    // Conservative byte budgets, not a claimed Jev tokenizer.
    maxInputTokens: z.number().int().min(256).max(60000).default(16000),
    maxContextBytes: z.number().int().min(256).max(48000).default(24000),
    maxDiffBytes: z.number().int().min(64).max(32000).default(12000),
    repo: z
      .object({
        include: z
          .array(z.string().min(1))
          .min(1)
          .default(["README.md", "src/**/*.ts"]),
        exclude: z.array(z.string().min(1)).default([]),
        maxFiles: z.number().int().min(1).max(100).default(30),
        maxFileBytes: z.number().int().min(64).max(16000).default(2000),
      })
      .strict()
      .default({}),
    labels: z
      .array(label)
      .min(1)
      .max(100)
      .superRefine((labels, ctx) => {
        const seen = new Set<string>();
        labels.forEach((l, i) => {
          const key = l.name.toLowerCase();
          if (seen.has(key))
            ctx.addIssue({
              code: "custom",
              message: "Duplicate label name",
              path: [i, "name"],
            });
          seen.add(key);
        });
      }),
  })
  .strict();
export type Config = z.infer<typeof configSchema>;
export type Label = Config["labels"][number];
export function parseConfig(text: string): Config {
  if (Buffer.byteLength(text) > 64000) throw new Error("Config exceeds 64 KB");
  const doc = parseDocument(text, { uniqueKeys: true });
  if (doc.errors.length) throw new Error("Invalid YAML");
  return configSchema.parse(doc.toJS({ maxAliasCount: 0 }));
}
