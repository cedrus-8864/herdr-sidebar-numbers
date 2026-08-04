# herdr-sidebar-numbers

A [herdr](https://herdr.dev) plugin that shows position numbers in the sidebar —
the same digits `switch_workspace` and `focus_agent` bind their `1..9` shortcuts
to, so you can see which one to press instead of counting rows.

herdr computes those positions but exposes no sidebar token for them. This
plugin publishes each workspace's and each agent's 1-based position as a `num`
metadata token, which you render as `$num`. It also publishes two
alignment/content helpers scoped to workspaces only: `$pad` (see below) and
`$tab_cwd`, the project name of whichever tab you last focused in that
workspace (see *`$tab_cwd`* below) — herdr's own `active_tab_id` per
workspace, not the single global `focused` pane.

```
 1  bk-volume              1  ✳ bk-volume-api
 2  expense-tracker        2  ✳ bk-volume-portal
 3  api                    3  ✳ expense-tracker
 4  ~                      4  ✳ api
```

Numbers are display-only metadata: your workspace names and pane borders keep
showing herdr's own labels.

## Install

Requires [bun](https://bun.sh) and herdr 0.8.0+.

```sh
herdr plugin install cedrus-8864/herdr-sidebar-numbers
```

Then add `$num` to your sidebar rows in `~/.config/herdr/config.toml`:

```toml
[ui.sidebar.spaces]
rows = [["$num", "state_icon", "workspace"], ["branch", "git_status"]]

[ui.sidebar.agents]
rows = [["$num", "state_icon", "pane"], ["agent", "terminal_title_stripped"]]
```

Both `rows` keys replace herdr's defaults, so keep whichever built-in tokens you
already had and just insert `$num`. Then:

```sh
herdr server reload-config
```

Numbers appear on the next event that changes the sidebar; run
`herdr plugin action invoke cedrus.sidebar-numbers.sync` to fill them in
immediately.

## When it renumbers

The plugin runs on the nine events that can move a row, each verified to
actually fire: eight on herdr 0.7.5 (workspaces created, closed, or
individually moved; tabs reordered; panes closed, moved, or exited; and a pane
being detected as an agent), plus `workspace.reordered` on 0.8.0 (its atomic
worktree-group reordering). It also runs at server startup, because herdr
keeps metadata tokens in memory only — a restarted server would otherwise come
back with an unnumbered sidebar until something happened.

Nothing polls. If a number ever looks stale, `herdr plugin action invoke
cedrus.sidebar-numbers.sync` recomputes everything.

`$tab_cwd` additionally refreshes on `tab.focused` — the one event that
changes a workspace's `active_tab_id` without moving any row, so it isn't in
the renumbering list above.

## `$tab_cwd` — showing what you're actually looking at

A workspace's own label is whatever you (or herdr) named it once — it doesn't
say which of its tabs you're currently in. `$tab_cwd` is the basename of the
working directory of a pane in your last-focused tab in that workspace, so a
row can show the project you're actually looking at right now:

```toml
[ui.sidebar.spaces]
rows = [
  ["$num", "state_icon", "workspace"],
  ["$pad", "branch", "git_status"],
  ["$pad", "$tab_cwd"],
]
```

```
3 · ○ api
  · build-staging ↓21
  · smartmenu-portal
```

It's on its own row, not swapped in for `workspace` on row 1, because a custom
token can't be styled bold — herdr only styles built-in tokens per their kind,
and a custom token in a styled map (`{ token = "$tab_cwd", bold = true }`)
passes `config check` and **renders nothing at all**, not just unstyled (same
trap as `$num`, below). Replacing `workspace` with `$tab_cwd` on row 1 works
and updates live, but the row it lands on goes visibly dim compared to every
row around it — pick that tradeoff deliberately, it isn't free.

It reads a pane's `cwd` directly rather than parsing herdr-autolabel's
rendered tab label (e.g. `"7 · smartmenu-portal · claude"`): parsing would tie
this plugin to autolabel's `tab_format` and break the moment that string
changes, or if autolabel isn't installed. For a tab with more than one pane it
picks whichever pane comes first in `api snapshot` order, not the visually
top-left one autolabel's own `tab_source = "active"` computes — close enough
for a glanceable hint, and simplicity has to lose *some* precision somewhere.

## `$pad` — lining up a workspace's second row

herdr indents an entry's second (and third, etc.) row by 2 columns, so it
starts under the number rather than under the label. `$pad` is a spacer token
that pushes it across, for a `["$num", "state_icon", <label>]` first row
(`workspace` or `$tab_cwd` — the pad width doesn't depend on which); reuse it
on every non-first row, `$tab_cwd`'s included:

```toml
[ui.sidebar.spaces]
rows = [
  ["$num", "state_icon", "workspace"],
  ["$pad", "branch", "git_status"],
  ["$pad", "$tab_cwd"],
]
```

```
2 · ● expense-tracker          2 · ● expense-tracker
  feat/auth/public-signup  ->    · feat/auth/public-signup
```

It is written on every workspace regardless of `agent_panel_sort` — it aligns
a row, it never points at one. Ignore the token and nothing changes. Unlike
`$num`, there's no way to make `branch`/`git_status` a single token the way
`herdr-autolabel`'s `$topic` collapses an agent's second row: herdr's API
exposes no `branch`/`git_status` field to compose one from, so the ` · `
separator herdr inserts after `$pad` stays on screen — there is no way to
remove it here.

The pad is 1 cell wide, confirmed against the exact row shape above; it is
**not** the same width as `herdr-autolabel`'s equivalent pad for an agent's
second row, because that row has a different first-row shape. Recount before
reusing this value anywhere else. It's U+2800 (braille blank), not a space —
herdr trims a whitespace-only token value to empty and drops the token.

## Notes

`$num` must be written as a bare string. `{ token = "$num", bold = true }`
passes `herdr config check` and then renders nothing — that is a herdr
limitation for custom tokens, not a bug here.

Agent numbers require the default `agent_panel_sort = "spaces"`. Under
`"priority"` the agent panel is an attention queue rather than a per-workspace
list, so the plugin **clears** agent numbers instead of writing misleading ones
— a wrong digit is worse than no digit. Workspace numbers are correct either
way.

Uninstalling leaves the last-written tokens behind; they simply stop updating.
Remove `$num` / `$pad` / `$tab_cwd` from your `rows` to hide them.

## License

MIT
