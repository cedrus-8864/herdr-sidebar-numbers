// herdr-sidebar-numbers -- herdr plugin
//
// Publishes each workspace's and each agent's 1-based sidebar position as a
// `num` metadata token, so the rows can render it as `$num`. These are the
// positions `switch_workspace` and `focus_agent` bind their 1..9 shortcuts to,
// so the sidebar ends up showing which digit to press.
//
// Display-only metadata: no label is written, so herdr keeps rendering its own
// workspace and pane names.
//
// ponytail: agent numbers assume `agent_panel_sort = "spaces"`. Under
// "priority" the panel is an attention queue and these digits would be wrong;
// herdr exposes no way to read that setting, so detect it by eye, not in code.

import { spawnSync } from "node:child_process";

const herdr = process.env.HERDR_BIN_PATH || "herdr";
const SOURCE = "sidebar-numbers";

function json(args) {
  const r = spawnSync(herdr, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (r.status !== 0) {
    throw new Error(`${herdr} ${args.join(" ")} failed: ${(r.stderr || r.stdout || "").trim()}`);
  }
  return r.stdout.trim() ? JSON.parse(r.stdout) : null;
}

// herdr reports tokens as strings, so `num` is compared and written as one --
// if that ever becomes a number the comparison silently writes on every run.
// Skipping unchanged rows is what keeps an event burst from spawning a process
// per row for nothing.
function writeNum(kind, id, current, num) {
  if (current === num) return;
  // herdr's CLI wants the positional before the flags and rejects --flag=value.
  json([kind, "report-metadata", id, "--source", SOURCE, "--token", `num=${num}`]);
}

const { workspaces, agents } = json(["api", "snapshot"]).result.snapshot;

workspaces.forEach((w) => writeNum("workspace", w.workspace_id, w.tokens?.num, String(w.number)));
// The snapshot already lists agents grouped by workspace order, which is what
// the "spaces" panel renders -- so list position is the shortcut digit.
agents.forEach((a, i) => writeNum("pane", a.pane_id, a.tokens?.num, String(i + 1)));

console.log(`numbered ${workspaces.length} workspace(s), ${agents.length} agent(s)`);
