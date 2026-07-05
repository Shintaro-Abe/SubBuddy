---
name: wbs-github-sync
description: Sync this repository's wbs/wbs.yml to the GitHub planning repository as Issues, sub-issues, Project v2 fields, and generated planning files. Use when the user says short phrases like "WBS同期", "GitHub反映", "WBS反映", "planning repoに反映", or asks to run setup:github, sync:github, sync:github:apply, initialize or verify the planning repo, or continue after GitHub auth has been completed.
---

# WBS GitHub Sync

## Overview

Synchronize `wbs/wbs.yml` to the private planning repo configured in `wbs/wbs.config.yml`.
The normal target is `Shintaro-Abe/SubBuddy-planning` and Project `#1`, but always read the config instead of hard-coding.

This workflow writes to GitHub. Always run an online dry-run first and get explicit user approval before `sync:github:apply`.

Short user requests that should trigger this skill include:

- `WBS同期`
- `GitHub反映`
- `WBS反映`
- `planning repoに反映`
- `WBSを反映して`
- `sync:githubして`

## Workflow

1. Confirm local context:
   - Run `npm --prefix wbs run` to confirm scripts exist.
   - Run `gh auth status` to confirm `repo` and `project` scopes.
   - If auth is missing or scopes are insufficient, ask the user to run:
     `gh auth refresh -h github.com -s project,read:project`

2. Initialize GitHub planning resources:
   - Run `npm --prefix wbs run setup:github`.
   - Expected successful states include:
     - `repo exists: ...`
     - `project exists: #...`
     - `GitHub planning setup complete: ...`

3. Run online dry-run:
   - Run `npm --prefix wbs run sync:github`.
   - Read and summarize:
     - Issue counts: added / updated / unchanged / close.
     - Project number.
     - Generated files.
     - Main added/updated WBS IDs and titles, capped to about 10 items unless the user asks for all.

4. Confirmation gate:
   - If dry-run shows `追加 0 / 更新 0 / close 0`, do not apply. Tell the user there is no GitHub Issue diff.
   - If there is any add/update/close, ask explicitly before writing.
   - Do not run `npm --prefix wbs run sync:github:apply` until the user clearly approves, for example `反映して`.

5. Apply:
   - Run `npm --prefix wbs run sync:github:apply`.
   - If it takes too long due to Project field updates, interrupt only after confirming Issue creation state with a dry-run or `gh issue list`.
   - Re-run apply idempotently if needed. The sync key is the Issue body marker `<!-- wbs-id: ... -->`, so reruns should not duplicate Issues.

6. Final verification:
   - Run `npm --prefix wbs run sync:github`.
   - Report the final counts. A clean Issue state should show `追加 0 / 更新 0`.

## Sandbox And Runtime Notes

- In this environment, `tsx` may fail inside the sandbox with:
  `Error: listen EPERM: operation not permitted /tmp/tsx-...pipe`
- If that happens, rerun the same npm command with `sandbox_permissions: "require_escalated"` and a clear justification.
- GitHub API access usually also needs escalated execution because network is restricted.
- The default write delay is 2 seconds per GitHub write. Full Project sync may take many minutes because each task can require several Project field updates.
- To shorten a large Project sync, use:
  `WBS_GITHUB_WRITE_DELAY_MS=250 npm --prefix wbs run sync:github:apply`
- Use the shorter delay only when the prior dry-run is understood and the user has approved apply.

## Long-Running Apply Recovery

If apply appears stuck:

1. Check process state with `ps -ef`.
2. Check GitHub state in a separate read-only command, for example:
   `gh issue list --repo <owner>/<repo> --limit 20 --json number,title,state`
3. If Issues were created but the process remains silent for many minutes, interrupt with Ctrl-C.
4. Run `npm --prefix wbs run sync:github`.
5. If the dry-run shows `追加 0 / 更新 0`, rerun apply to finish sub-issues, Project fields, and generated files.
6. Prefer setting `WBS_GITHUB_WRITE_DELAY_MS=250` on the rerun if the delay is the bottleneck.

## Reporting

Keep the final report concise:

- setup result
- initial dry-run counts
- apply result
- final dry-run counts
- any interruption/retry and why

Do not expose GitHub tokens or sensitive env values. If command output includes a token, redact it before reporting.
