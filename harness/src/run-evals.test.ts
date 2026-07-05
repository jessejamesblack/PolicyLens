import { describe, expect, it } from "vitest";
import { runEvalSuite } from "./run-evals";

describe("runEvalSuite", () => {
  it("passes all golden extraction fixtures", async () => {
    const results = await runEvalSuite();
    expect(results.every((result) => result.passed)).toBe(true);
  });
});

