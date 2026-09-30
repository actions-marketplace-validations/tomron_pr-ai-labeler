import type { Config, Label } from "./config.js";
import {
  collectContext,
  type ContextSource,
  type PullRequest,
} from "./context.js";
import { describeError } from "./errors.js";
import { applyLabels, type LabelWriter } from "./labels.js";
export interface Classifier {
  classify(config: Config, state: Record<string, string>): Promise<Label[]>;
}
export type Result =
  | { labels: string[]; status: "applied" | "dry-run" | "no-labels" }
  | { labels: []; status: "classification-failed"; reason: string };
export async function run(
  pr: PullRequest,
  config: Config,
  source: ContextSource,
  classifier: Classifier,
  writer: LabelWriter,
  dryRun: boolean,
): Promise<Result> {
  let selected: Label[];
  try {
    const state = await collectContext(pr, config, source);
    selected = await classifier.classify(config, state);
    // A second boundary rejects labels not defined by trusted configuration.
    if (selected.some((l) => !config.labels.some((allowed) => allowed === l)))
      throw new Error("Unexpected label");
  } catch (error) {
    return {
      labels: [],
      status: "classification-failed",
      reason: describeError(error),
    };
  }
  if (!selected.length) return { labels: [], status: "no-labels" };
  if (dryRun) return { labels: selected.map((l) => l.name), status: "dry-run" };
  await applyLabels(selected, writer);
  return { labels: selected.map((l) => l.name), status: "applied" };
}
