import type { Label } from "./config.js";
export interface LabelWriter {
  get(name: string): Promise<void>;
  create(label: Label): Promise<void>;
  add(names: string[]): Promise<void>;
}
function status(error: unknown): number | undefined {
  return typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
    ? error.status
    : undefined;
}
export async function applyLabels(
  selected: Label[],
  writer: LabelWriter,
): Promise<void> {
  if (!selected.length) return;
  for (const label of selected) {
    try {
      await writer.get(label.name);
    } catch (error) {
      if (status(error) !== 404) throw error;
      try {
        await writer.create(label);
      } catch (createError) {
        // A concurrent run may have created it. Do not hide other 422 errors.
        if (status(createError) !== 422) throw createError;
        await writer.get(label.name);
      }
    }
  }
  await writer.add(selected.map((l) => l.name));
}
