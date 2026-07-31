# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A [herdr](https://herdr.dev) plugin (herdr = terminal workspace manager for AI agents). herdr invokes
`bun number-sidebar.js` on subscribed events; the script writes each workspace's and each agent's
1-based sidebar position into a `num` metadata token. The user then renders it as `$num` in their own
`[ui.sidebar.*] rows`. No build step, no dependencies, no `package.json` — bun + node stdlib.

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
- **The plugin-hook allowlist is narrower than the events API** and not guessable: `workspace.updated`
  is rejected while the whole `workspace.created/closed/moved` lifecycle is accepted. A name appearing
  in `herdr api schema --json` proves the *server* emits it, never that a plugin may subscribe. After
  adding an event, run `herdr plugin list` and confirm zero warnings — a rejected hook fails silently
  otherwise.
- **Accepted is not delivered.** All eight subscribed events were confirmed to actually invoke the
  plugin. `workspace.moved` and `tab.moved` have no CLI, so triggering them means calling the socket
  directly — newline-delimited JSON to `$HERDR_SOCKET_PATH`, e.g.
  `{"id":"p","method":"workspace.move","params":{"workspace_id":"w1","insert_index":0}}`.
- **`herdr plugin log list --limit N` returns the OLDEST N runs**, printed oldest-first. Reading
  `logs[0]` as "the latest run" gives a stale answer that looks plausible.
- **Subscribe only to events that can renumber a row.** `workspace.focused` and `pane.created` were
  removed on purpose: both fire constantly and can never change a position (a fresh pane hosts no
  agent; it joins the list at `pane.agent_detected`).
- **herdr's CLI wants positionals before flags and rejects `--flag=value`.** Its errors name the
  argument it choked *after*, not the real cause.
- **Custom `$` tokens only render as bare strings** in `rows`. `{ token = "$num", bold = true }`
  passes `herdr config check` and then draws nothing.

## Testing

One end-to-end test that runs the script against the **live herdr session** and asserts every token
matches its position. That is deliberate: the three things that break here — herdr's CLI argument
shape, the string-vs-number token comparison, and the numbering — are all invisible to a mock. It is
safe to re-run because the plugin writes only display-only metadata.

## Repo conventions

Conventional commits (`feat(agents):`, `fix(events):`, `docs:`). Deliberate shortcuts are marked with
a `ponytail:` comment naming the ceiling.
