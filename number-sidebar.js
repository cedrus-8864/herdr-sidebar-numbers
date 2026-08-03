// herdr-sidebar-numbers -- herdr plugin
//
// Publishes each workspace's and each agent's 1-based sidebar position as a
// `num` metadata token, so the rows can render it as `$num`. These are the
// positions `switch_workspace` and `focus_agent` bind their 1..9 shortcuts to,
// so the sidebar ends up showing which digit to press.
//
// Display-only metadata: no label is written, so herdr keeps rendering its own
// workspace and pane names.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

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
  // An absent token reads as undefined; `num === null` means "clear it". Both
  // normalize to null so an already-absent token is not cleared every run.
  if ((current ?? null) === num) return;
  // herdr's CLI wants the positional before the flags and rejects --flag=value.
  const flags = num === null ? ["--clear-token", "num"] : ["--token", `num=${num}`];
  json([kind, "report-metadata", id, "--source", SOURCE, ...flags]);
}

// Only the "spaces" panel is a per-workspace list whose position matches the
// focus_agent digit. Under "priority" the panel is an attention queue, so any
// number we wrote would point at the wrong agent.
export function parseAgentPanelSort(configText) {
  const declared = configText.match(/^\s*agent_panel_sort\s*=\s*"(\w+)"/m)?.[1];
  return declared ?? "spaces";
}

// herdr hands us its socket path, so its config sits next to it -- no guessing
// at XDG layouts or $HOME.
function agentPanelSort() {
  const socket = process.env.HERDR_SOCKET_PATH;
  if (!socket) return "spaces";
  try {
    return parseAgentPanelSort(readFileSync(join(dirname(socket), "config.toml"), "utf8"));
  } catch {
    return "spaces";
  }
}

// Guarded so the test can import the pure helpers without renumbering anything.
if (import.meta.main) {
  const { workspaces, agents } = json(["api", "snapshot"]).result.snapshot;

  // Workspace numbers come straight from herdr and are correct under any sort.
  workspaces.forEach((w) => writeNum("workspace", w.workspace_id, w.tokens?.num, String(w.number)));

  const sort = agentPanelSort();
  const groupedByWorkspace = sort === "spaces" || sort === "workspaces";

  // The snapshot already lists agents grouped by workspace order, which is what
  // the "spaces" panel renders -- so list position is the shortcut digit.
  // Under any other sort we clear instead: a wrong digit is worse than none.
  agents.forEach((a, i) => {
    writeNum("pane", a.pane_id, a.tokens?.num, groupedByWorkspace ? String(i + 1) : null);
  });

  const note = groupedByWorkspace ? "" : ` (agent numbers cleared: agent_panel_sort = "${sort}")`;
  console.log(`numbered ${workspaces.length} workspace(s), ${agents.length} agent(s)${note}`);
}
