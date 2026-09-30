import { minimatch } from "minimatch";
import type { Config } from "./config.js";
import { budgetState, clip, fairClip } from "./budget.js";
export interface PullRequest {
  title: string;
  body: string | null;
  base: { sha: string };
}
export interface ChangedFile {
  filename: string;
  patch?: string;
}
export interface TreeEntry {
  path?: string;
  type?: string;
  size?: number;
}
export interface ContextSource {
  files(): Promise<ChangedFile[]>;
  tree(sha: string): Promise<{ tree: TreeEntry[]; truncated: boolean }>;
  content(path: string, sha: string): Promise<string | null>;
}
const BLOCKED =
  /(^|\/)(\.git|node_modules|dist|vendor|\.env[^/]*|\.npmrc|\.netrc|id_rsa|id_ed25519|credentials[^/]*|secrets?[^/]*)(\/|$)|\.(pem|key|p12|pfx|jks|keystore|lock)$/i;
export function allowedPath(path: string, config: Config): boolean {
  return (
    !BLOCKED.test(path) &&
    config.repo.include.some((g) => minimatch(path, g, { dot: true })) &&
    !config.repo.exclude.some((g) => minimatch(path, g, { dot: true }))
  );
}
export async function collectContext(
  pr: PullRequest,
  config: Config,
  source: ContextSource,
): Promise<Record<string, string>> {
  const state: Record<string, string> = {};
  if (config.context.includes("title")) state.title = pr.title;
  if (config.context.includes("body"))
    state.body = clip(pr.body ?? "", config.maxBodyBytes);
  if (config.context.includes("diff")) {
    const files = await source.files();
    state.diff = fairClip(
      files.map((f) => `${f.filename}\n${f.patch ?? "[patch unavailable]"}`),
      config.maxDiffBytes,
      2,
    ).join("\n\n");
  }
  if (config.context.some((c) => c === "repo-tree" || c === "repo-files")) {
    const result = await source.tree(pr.base.sha);
    if (result.truncated)
      throw new Error(
        "Repository tree is incomplete; narrow context or use a smaller repo",
      );
    const entries = result.tree.filter(
      (e) => e.type === "blob" && e.path && allowedPath(e.path, config),
    );
    if (config.context.includes("repo-tree"))
      state.repoTree = clip(
        entries.map((e) => e.path).join("\n"),
        config.maxContextBytes,
      );
    if (config.context.includes("repo-files")) {
      const parts: string[] = [];
      let total = 0;
      for (const entry of entries.slice(0, config.repo.maxFiles)) {
        const path = entry.path;
        if (!path || (entry.size ?? 0) > 1000000) continue;
        const content = await source.content(path, pr.base.sha);
        if (content === null || content.includes("\0")) continue;
        const piece = `${path}\n${clip(content, config.repo.maxFileBytes)}`;
        parts.push(piece);
        total += Buffer.byteLength(piece);
        if (total >= config.maxContextBytes) break;
      }
      state.repoFiles = clip(parts.join("\n\n"), config.maxContextBytes);
    }
  }
  return budgetState(state, config.maxContextBytes);
}
