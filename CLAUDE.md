# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A [herdr](https://herdr.dev) plugin (herdr = terminal workspace manager for AI agents). herdr invokes
`bun number-sidebar.js` on subscribed events; the script writes each workspace's and each agent's
1-based sidebar position into a `num` metadata token, plus two workspace-only tokens: a constant `pad`
spacer and `tab_cwd` (the cwd basename of the workspace's currently-active tab). The user renders those
as `$num` / `$pad` / `$tab_cwd` in their own `[ui.sidebar.*] rows`. No build step, no dependencies, no
`package.json` — bun + node stdlib.

## Commands

```sh
bun test                                              # the one e2e test (needs a running herdr)

herdr plugin action invoke cedrus.sidebar-numbers.sync   # manual run (the correct way to run it)
herdr plugin log list --plugin cedrus.sidebar-numbers --limit 5
herdr plugin link .                                   # install for local dev
herdr plugin list                                     # MUST report zero warnings after a manifest edit
```

After editing `herdr-plugin.toml`, re-run `herdr plugin link` — `herdr server reload-config` only
reloads herdr's own `config.toml`, not plugin manifests.

## Architecture

`number-sidebar.js` is a **one-shot script, not a daemon**. Every event spawns a fresh process that
reads the whole session (`herdr api snapshot`), diffs, writes, exits. No state file.

Three decisions carry the design:

1. **Metadata, never names.** Numbers go through `herdr <kind> report-metadata --source
   sidebar-numbers --token num=N`, which is display-only. Writing a pane/workspace *name* instead
   would render the same digit but suppress the live label herdr maintains there (and pane borders
   read that name). Never "fix" a rendering gap by renaming an entity.
2. **Change gating, no ownership state.** `api snapshot` reports the live token, so the script skips
   unchanged rows by comparing against it. Tokens come back as **strings** — the comparison writes
   `String(n)` to match. If herdr ever emits numeric tokens the gate silently writes on every run.
3. **Position comes from herdr, not from us.** Workspace numbers are `w.number` straight from the
   API; agent numbers are the snapshot's own agent order. An earlier version re-sorted agents by
   workspace and it was provably a no-op. Don't reintroduce a model of herdr's ordering.

### Constraints worth knowing before changing behavior

- **Agent numbers require `agent_panel_sort = "spaces"`.** Under `"priority"` the panel is an
  attention queue and list position would point at the wrong agent, so the plugin clears `num` on
  agents instead of writing it. The setting is read from `dirname($HERDR_SOCKET_PATH)/config.toml` —
  herdr passes the socket path to every plugin, which beats guessing at XDG layouts.
- **Metadata tokens are runtime-only.** `session.json` does not persist them, so a restarted server
  has an unnumbered sidebar until something happens. That is what the `[[startup]]` command is for.
- **`startup` is an array of tables.** `[startup]` fails the manifest parse with `invalid type: map,
  expected a sequence`; it must be `[[startup]]`. A broken manifest degrades to
  `manifest unavailable` in `herdr plugin list` and the plugin silently stops receiving events.
- **The plugin-hook allowlist is narrower than the events API, not guessable, and moves between
  versions.** On 0.7.5, `workspace.updated` was rejected while the rest of the
  `workspace.created/closed/moved` lifecycle was accepted — the allowlist is not "all lifecycle events
  for an entity." On 0.8.0 `workspace.updated` and the new `workspace.reordered`/`tab.renamed`/
  `worktree.created`/`worktree.removed` became accepted, while `pane.updated`, `pane.output_changed`
  and the new `workspace.metadata_updated`/`layout.updated` are still rejected — checked directly by
  linking a scratch manifest covering every candidate `on =` value and reading `warnings` off `herdr
  plugin list --json` (no live event needed for this half of the check; see the next point for the
  other half). A name appearing in `herdr api schema --json` proves the *server* emits it, never that
  a plugin may subscribe — and neither check is a one-time fact: re-run it after any herdr upgrade
  before assuming last version's allowlist still holds.
- **Accepted is not delivered.** All nine subscribed events were confirmed to actually invoke the
  plugin. `workspace.moved` and `tab.moved` have no CLI, so triggering them means calling the socket
  directly — newline-delimited JSON to `$HERDR_SOCKET_PATH`, e.g.
  `{"id":"p","method":"workspace.move","params":{"workspace_id":"w1","insert_index":0}}`.
  `workspace.reordered` (added for 0.8.0's atomic worktree-group reordering / `workspace.move_block`)
  has the same no-CLI shape (`{"method":"workspace.move_block","params":{"workspace_ids":[...],
  "before_workspace_id":"..."}}`), and both a raw-socket call and an actual worktree-group drag reorder
  the user's live workspaces — confirming *this one* specifically needed the user to drag a real
  worktree group and check the log, since a raw-socket call was blocked as too invasive to run
  unprompted (auto-mode declined it outright; it bypasses the CLI the classifier reasons about).
- **`herdr plugin log list --limit N` returns the OLDEST N runs**, printed oldest-first. Reading
  `logs[0]` as "the latest run" gives a stale answer that looks plausible.
- **Subscribe only to events that can change what's rendered — renumbering a row is one way, changing a
  row's content is another.** `workspace.focused` and `pane.created` stay unsubscribed: both fire
  constantly and change neither. `tab.focused` **is** subscribed despite changing no position, because
  it's the only event that moves a workspace's `active_tab_id`, which `tab_cwd` reads — don't read
  "only renumbering events" as "only position-affecting events" when deciding whether a new event
  belongs here.
- **herdr's CLI wants positionals before flags and rejects `--flag=value`.** Its errors name the
  argument it choked *after*, not the real cause.
- **Custom `$` tokens only render as bare strings** in `rows`. `{ token = "$num", bold = true }`
  passes `herdr config check` and then draws nothing.
- **A spacer token always leaves the ` · ` herdr inserts after it on screen as a stray dot** — a row
  of *one* token has nothing to separate, so the dot only goes away by collapsing the row to a single
  composed token. `pad` on **agents** was tried and reverted this way: `$topic` in herdr-autolabel
  collapses that row to one token instead, because the topic *is* available to compose (`terminal_
  title_stripped` is in the API). `pad` on **workspaces** stays a spacer with a visible dot, on
  purpose — `branch`/`git_status` are **not** in `WorkspaceInfo`, so there is nothing to compose a
  single token from, and a spacer plus a dot is the only alignment available. Don't try to remove the
  dot here by copying the agents fix; that door doesn't exist for workspaces until herdr's API exposes
  git info.
- **Two `$pad`-shaped tokens, two different widths, not interchangeable.** `WORKSPACE_PAD` is 1 cell,
  sized for `["$num", "state_icon", "workspace"]` as the first row; herdr-autolabel's agent-row pad
  (reverted, but the reasoning still applies to any future one) was sized for a *different* first row
  shape. Both were confirmed by a live screenshot, not derived from a general formula — the two rows
  don't share enough structure for one constant to be safely reused between them. Recount from the
  actual `rows` config before reusing either value anywhere else.
- **Write metadata tokens, never `display_agent` or `title`.** Those look like display-only channels
  too, but they are *shared* — the sidebar, the pane borders and other plugins' notifiers all read
  them, so padding one to fix a sidebar column corrupts every other consumer. `tokens` is the only
  surface nothing else reads.
- **Derive `tab_cwd` from a pane's own `cwd`, never from herdr-autolabel's rendered tab label.** The
  rendered label (`"7 · smartmenu-portal · claude"`) is a *composed* string owned by a different
  plugin's `tab_format` config; parsing it back apart couples this plugin to that format string and to
  autolabel being installed at all. `cwd` is raw API data with no such dependency. Also: "first pane in
  `api snapshot` order" is a deliberate simplification, not the visually top-left pane
  herdr-autolabel's own `tab_source = "active"` computes via `pane layout` — good enough for a
  glanceable hint, not worth a second CLI call per workspace to match exactly.

## Testing

One end-to-end test that runs the script against the **live herdr session** and asserts every token
matches its position. That is deliberate: the three things that break here — herdr's CLI argument
shape, the string-vs-number token comparison, and the numbering — are all invisible to a mock. It is
safe to re-run because the plugin writes only display-only metadata.

## Repo conventions

Conventional commits (`feat(agents):`, `fix(events):`, `docs:`). Deliberate shortcuts are marked with
a `ponytail:` comment naming the ceiling.
