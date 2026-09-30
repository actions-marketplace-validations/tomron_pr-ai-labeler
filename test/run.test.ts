import { it, expect, vi } from "vitest";
import { run } from "../src/run.js";
import { parseConfig } from "../src/config.js";
const config = parseConfig(
  "context: [title]\nlabels:\n  - name: bug\n    description: fixes incorrect behavior",
);
const pr = { title: "fix", body: null, base: { sha: "base" } };
const source = { files: vi.fn(), tree: vi.fn(), content: vi.fn() };
function writer() {
  return { get: vi.fn(), create: vi.fn(), add: vi.fn() };
}
it("model failure produces a clean no-label exit", async () => {
  const w = writer();
  const result = await run(
    pr,
    config,
    source,
    { classify: vi.fn().mockRejectedValue(new Error("bad response")) },
    w,
    false,
  );
  expect(result).toEqual({ labels: [], status: "classification-failed" });
  expect(w.get).not.toHaveBeenCalled();
  expect(w.add).not.toHaveBeenCalled();
});
it("dry-run does not create or apply labels", async () => {
  const w = writer();
  const result = await run(
    pr,
    config,
    source,
    { classify: vi.fn().mockResolvedValue(config.labels) },
    w,
    true,
  );
  expect(result.status).toBe("dry-run");
  expect(w.get).not.toHaveBeenCalled();
  expect(w.create).not.toHaveBeenCalled();
  expect(w.add).not.toHaveBeenCalled();
});
it("rejects any unconfigured label before mutation", async () => {
  const w = writer();
  const result = await run(
    pr,
    config,
    source,
    {
      classify: vi
        .fn()
        .mockResolvedValue([{ ...config.labels[0], name: "deploy" }]),
    },
    w,
    false,
  );
  expect(result.status).toBe("classification-failed");
  expect(w.add).not.toHaveBeenCalled();
});
it("applies validated configured labels", async () => {
  const w = writer();
  const result = await run(
    pr,
    config,
    source,
    { classify: vi.fn().mockResolvedValue(config.labels) },
    w,
    false,
  );
  expect(result).toEqual({ labels: ["bug"], status: "applied" });
  expect(w.add).toHaveBeenCalledWith(["bug"]);
});
it("write permission errors fail rather than falsely reporting success", async () => {
  const w = writer();
  w.get.mockRejectedValue({ status: 403 });
  await expect(
    run(
      pr,
      config,
      source,
      { classify: vi.fn().mockResolvedValue(config.labels) },
      w,
      false,
    ),
  ).rejects.toEqual({ status: 403 });
});
