# herdr-sidebar-numbers

A [herdr](https://herdr.dev) plugin that shows position numbers in the sidebar —
the same digits `switch_workspace` and `focus_agent` bind their `1..9` shortcuts
to, so you can see which one to press instead of counting rows.

herdr computes those positions but exposes no sidebar token for them. This
plugin publishes each workspace's and each agent's 1-based position as a `num`
metadata token, which you render as `$num`.

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

## `$pad` — lining up a workspace's second row

herdr indents an entry's second row by 2 columns, so it starts under the
number rather than under the label. `$pad` is a spacer token that pushes it
across, for a `["$num", "state_icon", "workspace"]` first row:

```toml
[ui.sidebar.spaces]
rows = [["$num", "state_icon", "workspace"], ["$pad", "branch", "git_status"]]
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
Remove `$num` / `$pad` from your `rows` to hide them.

## License

MIT
