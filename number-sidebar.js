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
import { basename, dirname, join } from "node:path";

const herdr = process.env.HERDR_BIN_PATH || "herdr";
const SOURCE = "sidebar-numbers";

// Spacer for a workspace's second sidebar row, so `branch`/`git_status` start
// under `workspace` on the row above instead of under `$num`. Width is 1 cell,
// confirmed empirically against a live `["$num", "state_icon", "workspace"]` /
// ["$pad", "branch", "git_status"]` layout (screenshot-verified, not derived --
// a from-scratch cell count for a *different* first row shape (agents')
// previously produced a wrong guess). U+2800 (braille blank), not a space:
// herdr trims a whitespace-only token value to empty and drops the token.
// ponytail: fixed for that exact first row. Recount if either row's tokens change.
export const WORKSPACE_PAD = "⠀";

function json(args) {
  const r = spawnSync(herdr, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (r.status !== 0) {
    throw new Error(`${herdr} ${args.join(" ")} failed: ${(r.stderr || r.stdout || "").trim()}`);
  }
  return r.stdout.trim() ? JSON.parse(r.stdout) : null;
}

// herdr reports tokens as strings, so a value is compared and written as one --
// if that ever becomes a number the comparison silently writes on every run.
// Skipping unchanged rows is what keeps an event burst from spawning a process
// per row for nothing.
function writeToken(kind, id, name, current, value) {
  // An absent token reads as undefined; `value === null` means "clear it". Both
  // normalize to null so an already-absent token is not cleared every run.
  if ((current ?? null) === value) return;
  // herdr's CLI wants the positional before the flags and rejects --flag=value.
  const flags = value === null ? ["--clear-token", name] : ["--token", `${name}=${value}`];
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

// A workspace's active_tab_id is herdr's own "last-focused tab in this
// workspace" -- separate from the single globally `focused` pane, and exactly
// what a sidebar row wants for "what am I actually looking at in here". We
// derive the label from that tab's own first pane's cwd rather than parsing
// herdr-autolabel's rendered tab label (e.g. "7 · smartmenu-portal · claude"):
// parsing ties this plugin to autolabel's tab_format and breaks the moment
// that format string changes, or if autolabel isn't installed / sync_tabs is
// off. "First pane" is list order, not the layout-sorted top-left pane
// autolabel's `tab_source = "active"` computes -- close enough for a glanceable
// hint, not worth a second `pane layout` call per workspace to match exactly.
function activeTabCwd(workspace, panesByTab) {
  const cwd = panesByTab.get(workspace.active_tab_id)?.cwd;
  return cwd ? basename(cwd) : null;
}

// Guarded so the test can import the pure helpers without renumbering anything.
if (import.meta.main) {
  const { workspaces, agents, panes } = json(["api", "snapshot"]).result.snapshot;

  // First pane in snapshot order per tab -- see activeTabCwd() above.
  const panesByTab = new Map();
  for (const p of panes) {
    if (!panesByTab.has(p.tab_id)) panesByTab.set(p.tab_id, p);
  }

  // Workspace numbers come straight from herdr and are correct under any sort.
  // `pad` and `tab_cwd` are independent of numbering: they describe a row, they
  // never point at one.
  workspaces.forEach((w) => {
    writeToken("workspace", w.workspace_id, "num", w.tokens?.num, String(w.number));
    writeToken("workspace", w.workspace_id, "pad", w.tokens?.pad, WORKSPACE_PAD);
    writeToken("workspace", w.workspace_id, "tab_cwd", w.tokens?.tab_cwd, activeTabCwd(w, panesByTab));
  });

  const sort = agentPanelSort();
  const groupedByWorkspace = sort === "spaces" || sort === "workspaces";

  // The snapshot already lists agents grouped by workspace order, which is what
  // the "spaces" panel renders -- so list position is the shortcut digit.
  // Under any other sort we clear instead: a wrong digit is worse than none.
  agents.forEach((a, i) => {
    writeToken("pane", a.pane_id, "num", a.tokens?.num, groupedByWorkspace ? String(i + 1) : null);
  });

  const note = groupedByWorkspace ? "" : ` (agent numbers cleared: agent_panel_sort = "${sort}")`;
  console.log(`numbered ${workspaces.length} workspace(s), ${agents.length} agent(s)${note}`);
}
