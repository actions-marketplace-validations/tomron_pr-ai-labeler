import { describe, it, expect, vi } from "vitest";
import { applyLabels } from "../src/labels.js";
const label = {
  name: "bug",
  description: "fix",
  color: "abcdef",
  instructions: "",
};
describe("labels", () => {
  it("no labels means no writes", async () => {
    const w = { get: vi.fn(), create: vi.fn(), add: vi.fn() };
    await applyLabels([], w);
    expect(w.get).not.toHaveBeenCalled();
    expect(w.add).not.toHaveBeenCalled();
  });
  it("creates missing label before applying", async () => {
    const w = {
      get: vi.fn().mockRejectedValue({ status: 404 }),
      create: vi.fn(),
      add: vi.fn(),
    };
    await applyLabels([label], w);
    expect(w.create).toHaveBeenCalledWith(label);
    expect(w.add).toHaveBeenCalledWith(["bug"]);
    expect(w.create.mock.invocationCallOrder[0]).toBeLessThan(
      w.add.mock.invocationCallOrder[0]!,
    );
  });
  it("does not mask auth errors", async () => {
    const w = {
      get: vi.fn().mockRejectedValue({ status: 403 }),
      create: vi.fn(),
      add: vi.fn(),
    };
    await expect(applyLabels([label], w)).rejects.toEqual({ status: 403 });
    expect(w.add).not.toHaveBeenCalled();
  });
  it("handles creation race only with verified readback", async () => {
    const w = {
      get: vi
        .fn()
        .mockRejectedValueOnce({ status: 404 })
        .mockResolvedValue(undefined),
      create: vi.fn().mockRejectedValue({ status: 422 }),
      add: vi.fn(),
    };
    await applyLabels([label], w);
    expect(w.get).toHaveBeenCalledTimes(2);
    expect(w.add).toHaveBeenCalled();
  });
});
