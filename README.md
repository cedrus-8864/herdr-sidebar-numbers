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

Requires [bun](https://bun.sh) and herdr 0.7.0+.

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

## `$pad` — lining a second agent row up with the first

herdr indents an entry's second row by 2 columns, so it starts under the number
rather than under the label. `$pad` is a spacer token that pushes it across:

```toml
[ui.sidebar.agents]
rows = [["$num", "state_icon", "pane"], ["$pad", "terminal_title_stripped"]]
```

```
1 · ✔ bk-volume-api          1 · ✔ bk-volume-api
claude · Claude Code   ->          ·  Claude Code
```

It is written on every agent, under any `agent_panel_sort` — it aligns a row, it
never points at one. Ignore the token and nothing changes.

The offset is **3 + the pad's own width**, because herdr inserts its `" · "`
separator after the token — which is also why that separator survives as a
bullet, and why no pad width can produce a shift smaller than 4. The width is
fixed at 3 cells for a `["$num", "state_icon", "pane"]` first row; a different
first row needs `PAD_CELLS` in `number-sidebar.js` changed to match.

The pad is U+2800 (braille blank), not a space — herdr trims a whitespace-only
token value to empty and then drops the token.

## When it renumbers

The plugin runs on the eight events that can move a row, each verified to
actually fire on herdr 0.7.5: workspaces created, closed, or reordered; tabs
reordered; panes closed, moved, or exited; and a pane being detected as an
agent. It also runs at server startup, because herdr keeps metadata tokens in
memory only — a restarted server would otherwise come back with an unnumbered
sidebar until something happened.

Nothing polls. If a number ever looks stale, `herdr plugin action invoke
cedrus.sidebar-numbers.sync` recomputes everything.

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
