import * as core from "@actions/core";
import * as github from "@actions/github";
import { z } from "zod";
import { configSchema, parseConfig } from "./config.js";
import { classify } from "./classifier.js";
import { run } from "./run.js";
const eventSchema = z.object({
  number: z.number().int().positive(),
  pull_request: z.object({
    title: z.string(),
    body: z.string().nullable(),
    base: z.object({
      sha: z.string().regex(/^[a-f0-9]{40}$/),
      repo: z.object({ full_name: z.string() }),
    }),
  }),
});
export async function main(): Promise<void> {
  core.setOutput("labels", "[]");
  const eventName = github.context.eventName;
  if (eventName !== "pull_request" && eventName !== "pull_request_target") {
    core.setOutput("status", "skipped");
    core.info("Not a pull request event.");
    return;
  }
  const event = eventSchema.parse(github.context.payload);
  const { owner, repo } = github.context.repo;
  if (event.pull_request.base.repo.full_name !== `${owner}/${repo}`)
    throw new Error("Event repository mismatch");
  const apiKey = core.getInput("api-key", { required: true });
  core.setSecret(apiKey);
  const token = core.getInput("github-token", { required: true });
  core.setSecret(token);
  const client = github.getOctokit(token);
  const configPath = core.getInput("config-path") || ".github/pr-labeler.yml";
  if (
    configPath.startsWith("/") ||
    configPath.split("/").some((p) => p === "..")
  )
    throw new Error("Invalid configuration path");
  async function content(path: string, sha: string): Promise<string | null> {
    const { data } = await client.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: sha,
    });
    if (
      Array.isArray(data) ||
      data.type !== "file" ||
      !("content" in data) ||
      data.encoding !== "base64"
    )
      return null;
    return Buffer.from(data.content, "base64").toString("utf8");
  }
  const yaml = await content(configPath, event.pull_request.base.sha);
  if (yaml === null)
    throw new Error("Configuration must be a YAML file at the PR base commit");
  const config = parseConfig(yaml);
  const tokenLimit = core.getInput("max-input-tokens");
  if (tokenLimit) {
    if (!/^\d+$/.test(tokenLimit))
      throw new Error("max-input-tokens must be an integer");
    config.maxInputTokens = configSchema.shape.maxInputTokens.parse(
      Number(tokenLimit),
    );
  }
  core.info(
    `Classifier endpoint: ${new URL(config.endpoint).origin}. Selected context will be sent there.`,
  );
  const dryRun = core.getBooleanInput("dry-run");
  const result = await run(
    event.pull_request,
    config,
    {
      files: async () =>
        client.paginate(client.rest.pulls.listFiles, {
          owner,
          repo,
          pull_number: event.number,
          per_page: 100,
        }),
      tree: async (sha) => {
        const { data } = await client.rest.git.getTree({
          owner,
          repo,
          tree_sha: sha,
          recursive: "1",
        });
        return { tree: data.tree, truncated: data.truncated };
      },
      content,
    },
    { classify: (cfg, state) => classify(cfg, state, apiKey) },
    {
      get: async (name) => {
        await client.rest.issues.getLabel({ owner, repo, name });
      },
      create: async (label) => {
        await client.rest.issues.createLabel({
          owner,
          repo,
          name: label.name,
          color: label.color,
          description: label.description,
        });
      },
      add: async (labels) => {
        await client.rest.issues.addLabels({
          owner,
          repo,
          issue_number: event.number,
          labels,
        });
      },
    },
    dryRun,
  );
  core.setOutput("labels", JSON.stringify(result.labels));
  core.setOutput("status", result.status);
  if (result.status === "classification-failed")
    core.warning(
      `Classification/context collection failed (${result.reason ?? "unknown"}). No labels were created or applied.`,
    );
  else
    core.info(
      `Classification completed: ${result.status}; ${result.labels.length} label(s).`,
    );
}
