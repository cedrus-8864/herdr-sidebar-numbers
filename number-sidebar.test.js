import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";

// Runs against the live herdr session on purpose: the three things that can
// break here are herdr's CLI argument shape, the string-vs-number token
// comparison, and the numbering itself -- none of which a mock would exercise.
// Safe to re-run: the plugin only writes display-only metadata, never a label.
test("every workspace and agent carries its 1-based position", () => {
  const run = spawnSync("bun", ["number-sidebar.js"], { encoding: "utf8", cwd: import.meta.dir });
  expect(run.stderr.trim()).toBe("");
  expect(run.status).toBe(0);

  const snapshot = JSON.parse(spawnSync("herdr", ["api", "snapshot"], { encoding: "utf8" }).stdout)
    .result.snapshot;

  expect(snapshot.workspaces.map((w) => w.tokens?.num)).toEqual(
    snapshot.workspaces.map((w) => String(w.number)),
  );
  expect(snapshot.agents.map((a) => a.tokens?.num)).toEqual(
    snapshot.agents.map((_, i) => String(i + 1)),
  );
});
