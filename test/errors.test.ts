import { it, expect } from "vitest";
import { ZodError } from "zod";
import { describeError } from "../src/errors.js";
it("reports field paths, not values", () => {
  const error = new ZodError([
    { code: "custom", path: ["labels", 0, "name"], message: "Duplicate" },
  ]);
  expect(describeError(error)).toBe("labels.0.name: Duplicate");
});
it("hides JSON.parse messages that may echo the response body", () => {
  expect(describeError(new SyntaxError('Unexpected token "secret"'))).toBe(
    "Malformed JSON",
  );
});
it("passes through our own errors and tolerates unknown values", () => {
  expect(describeError(new Error("Classifier HTTP 401"))).toBe(
    "Classifier HTTP 401",
  );
  expect(describeError("boom")).toBe("Unknown error");
});
