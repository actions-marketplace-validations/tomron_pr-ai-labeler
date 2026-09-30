import { it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  input: vi.fn(),
  output: vi.fn(),
  secret: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  failed: vi.fn(),
  content: vi.fn(),
  create: vi.fn(),
  add: vi.fn(),
  getLabel: vi.fn(),
  paginate: vi.fn(),
  context: {
    eventName: "pull_request_target",
    repo: { owner: "owner", repo: "repo" },
    payload: {
      number: 1,
      pull_request: {
        title: "fix",
        body: "details",
        base: { sha: "a".repeat(40), repo: { full_name: "owner/repo" } },
      },
    },
  },
}));
vi.mock("@actions/core", () => ({
  getInput: mocks.input,
  setOutput: mocks.output,
  setSecret: mocks.secret,
  info: mocks.info,
  warning: mocks.warning,
  setFailed: mocks.failed,
}));
vi.mock("@actions/github", () => ({
  context: mocks.context,
  getOctokit: () => ({
    paginate: mocks.paginate,
    rest: {
      repos: { getContent: mocks.content },
      pulls: { listFiles: vi.fn() },
      git: { getTree: vi.fn() },
      issues: {
        getLabel: mocks.getLabel,
        createLabel: mocks.create,
        addLabels: mocks.add,
      },
    },
  }),
}));
import { main } from "../src/index.js";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.eventName = "pull_request_target";
  mocks.input.mockImplementation(
    (name: string) =>
      ({
        "api-key": "dummy-key",
        "github-token": "dummy-token",
        "config-path": ".github/pr-labeler.yml",
        "dry-run": "true",
        "max-input-tokens": "16000",
      })[name] ?? "",
  );
  mocks.content.mockResolvedValue({
    data: {
      type: "file",
      encoding: "base64",
      content: Buffer.from(
        "context: [title]\nlabels:\n  - name: bug\n    description: Fix",
      ).toString("base64"),
    },
  });
});
it("reads config only from immutable PR base, masks keys and dry-runs", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "jev",
          answers: { label_0: { type: "noul", noul: 0.99 } },
        }),
      ),
    ),
  );
  await main();
  expect(mocks.content).toHaveBeenCalledWith(
    expect.objectContaining({ ref: "a".repeat(40) }),
  );
  expect(mocks.secret).toHaveBeenCalledWith("dummy-key");
  expect(mocks.output).toHaveBeenCalledWith("labels", '["bug"]');
  expect(mocks.output).toHaveBeenCalledWith("status", "dry-run");
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.add).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
it("returns classification-failed with no writes on HTTP error", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("private", { status: 500 })),
  );
  await main();
  expect(mocks.output).toHaveBeenCalledWith("status", "classification-failed");
  expect(mocks.add).not.toHaveBeenCalled();
  expect(mocks.warning).toHaveBeenCalledWith(
    expect.not.stringContaining("private"),
  );
  vi.unstubAllGlobals();
});
it("skips other events before reading secrets", async () => {
  mocks.context.eventName = "push";
  await main();
  expect(mocks.input).not.toHaveBeenCalled();
  expect(mocks.output).toHaveBeenCalledWith("status", "skipped");
});
