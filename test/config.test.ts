import { describe, it, expect } from "vitest";
import { parseConfig } from "../src/config.js";
const base =
  "labels:\n  - name: bug\n    description: Fixes incorrect behavior\n";
describe("config", () => {
  it("fills safe defaults", () =>
    expect(parseConfig(base).threshold).toBe(0.8));
  it("rejects unknown fields", () =>
    expect(() => parseConfig(base + "unknownField: value\n")).toThrow());
  it("rejects duplicate labels case-insensitively", () =>
    expect(() =>
      parseConfig(base + "  - name: BUG\n    description: Same label\n"),
    ).toThrow());
  it("rejects duplicate YAML keys", () =>
    expect(() =>
      parseConfig(base + "threshold: 0.8\nthreshold: 0.9"),
    ).toThrow());
  it("rejects aliases", () =>
    expect(() => parseConfig("labels: &l []\nrepo: *l")).toThrow());
  it("rejects dangerous threshold", () =>
    expect(() => parseConfig(base + "threshold: 0")).toThrow());
  it("rejects invalid colors", () =>
    expect(() =>
      parseConfig(
        base.replace("description:", "color: invalid\n    description:"),
      ),
    ).toThrow());
});
