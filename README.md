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

The plugin runs on the nine events that can move a row. Eight were verified to
actually fire on herdr 0.7.5: workspaces created, closed, or individually
moved; tabs reordered; panes closed, moved, or exited; and a pane being
detected as an agent. The ninth, `workspace.reordered` (herdr 0.8.0's atomic
worktree-group reordering), is confirmed *accepted* by the manifest parser but
not yet confirmed *delivered* — see the events note in `herdr-plugin.toml`. It
also runs at server startup, because herdr keeps metadata tokens in memory
only — a restarted server would otherwise come back with an unnumbered sidebar
until something happened.

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
Remove `$num` from your `rows` to hide them.

## License

MIT
