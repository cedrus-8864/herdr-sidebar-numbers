import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { PAD, parseAgentPanelSort } from "./number-sidebar.js";

// Runs against the live herdr session on purpose: the things that break here
// are herdr's CLI argument shape, the string-vs-number token comparison, and
// the numbering itself -- none of which a mock would exercise. Safe to re-run:
// the plugin only writes display-only metadata, never a label.
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
  // A whitespace pad would be trimmed away and the token silently dropped.
  expect(snapshot.agents.map((a) => a.tokens?.pad)).toEqual(snapshot.agents.map(() => PAD));
});

// herdr ships its default config fully commented out, so the parser has to read
// a declared value without matching the commented example above it.
test("reads a declared agent_panel_sort, ignoring the commented default", () => {
  expect(parseAgentPanelSort('# agent_panel_sort = "spaces"\nagent_panel_sort = "priority"\n')).toBe(
    "priority",
  );
  expect(parseAgentPanelSort('# agent_panel_sort = "spaces"\n')).toBe("spaces");
  expect(parseAgentPanelSort("")).toBe("spaces");
});
