import { describe, it, expect, vi } from "vitest";
import { parseConfig } from "../src/config.js";
import { clip, budgetState } from "../src/budget.js";
import { allowedPath, collectContext } from "../src/context.js";
const config = parseConfig("labels:\n  - name: bug\n    description: Bug fix");
describe("context safety", () => {
  it("clips UTF-8 without replacement characters", () => {
    expect(clip("😀abc", 3)).toBe("");
    expect(clip("😀abc", 4)).toBe("😀");
  });
  it("bounds actual JSON bytes even with escape expansion", () => {
    const result = budgetState(
      { title: '"\\\n'.repeat(1000), diff: "😀".repeat(1000) },
      256,
    );
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(256);
  });
  it("excludes secrets even under broad globs", () => {
    const all = { ...config, repo: { ...config.repo, include: ["**/*"] } };
    for (const path of [
      ".env",
      "src/secrets.json",
      "private.pem",
      "node_modules/x.js",
      ".npmrc",
    ])
      expect(allowedPath(path, all)).toBe(false);
    expect(allowedPath("src/a.ts", all)).toBe(true);
  });
  it("only fetches selected context", async () => {
    const source = { files: vi.fn(), tree: vi.fn(), content: vi.fn() };
    const result = await collectContext(
      { title: "test", body: "private", base: { sha: "abc" } },
      { ...config, context: ["title"] },
      source,
    );
    expect(result).toEqual({ title: "test" });
    expect(source.files).not.toHaveBeenCalled();
  });
  it("repo contents use immutable base SHA, never PR head", async () => {
    const source = {
      files: vi.fn(),
      tree: vi.fn().mockResolvedValue({
        tree: [{ path: "src/a.ts", type: "blob" }],
        truncated: false,
      }),
      content: vi.fn().mockResolvedValue("source"),
    };
    await collectContext(
      { title: "x", body: null, base: { sha: "safe" } },
      { ...config, context: ["repo-files"] },
      source,
    );
    expect(source.content).toHaveBeenCalledWith("src/a.ts", "safe");
  });
  it("rejects truncated repo tree", async () => {
    await expect(
      collectContext(
        { title: "x", body: null, base: { sha: "safe" } },
        { ...config, context: ["repo-tree"] },
        {
          files: vi.fn(),
          tree: vi.fn().mockResolvedValue({ tree: [], truncated: true }),
          content: vi.fn(),
        },
      ),
    ).rejects.toThrow("incomplete");
  });
  it("bounds diffs and exposes absent patches", async () => {
    const result = await collectContext(
      { title: "x", body: null, base: { sha: "safe" } },
      { ...config, maxDiffBytes: 64, context: ["diff"] },
      {
        files: vi
          .fn()
          .mockResolvedValue([
            { filename: "binary.png" },
            { filename: "a", patch: "x".repeat(1000) },
          ]),
        tree: vi.fn(),
        content: vi.fn(),
      },
    );
    expect(Buffer.byteLength(result.diff ?? "")).toBeLessThanOrEqual(64);
    expect(result.diff).toContain("patch unavailable");
  });
  it("keeps every file in the diff when one patch is huge", async () => {
    const result = await collectContext(
      { title: "x", body: null, base: { sha: "safe" } },
      { ...config, maxDiffBytes: 400, context: ["diff"] },
      {
        files: vi.fn().mockResolvedValue([
          { filename: "big.ts", patch: "x".repeat(5000) },
          { filename: "small.ts", patch: "+one line" },
        ]),
        tree: vi.fn(),
        content: vi.fn(),
      },
    );
    expect(result.diff).toContain("small.ts\n+one line");
    expect(Buffer.byteLength(result.diff ?? "")).toBeLessThanOrEqual(400);
  });
  it("caps the PR body so it cannot consume the whole budget", async () => {
    const result = await collectContext(
      { title: "x", body: "b".repeat(10000), base: { sha: "safe" } },
      { ...config, maxBodyBytes: 100, context: ["body"] },
      { files: vi.fn(), tree: vi.fn(), content: vi.fn() },
    );
    expect(Buffer.byteLength(result.body ?? "")).toBe(100);
  });
});
