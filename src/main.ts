import * as core from "@actions/core";
import { main } from "./index.js";
import { describeError } from "./errors.js";
main().catch((error: unknown) => {
  core.setOutput("status", "failed");
  core.setFailed(`PR labeler failed: ${describeError(error)}`);
});
