# Repository Agent Instructions

## Authoritative development environment

- The authoritative development checkout is the Ubuntu WSL2 checkout.
- Run Git, Node/npm/npx, Docker, Supabase, Codex, Claude, and BMAD commands inside Ubuntu WSL.
- Do not develop in or synchronize changes back to the stale Windows checkout at `C:\stena-content-portal`.
- Keep secrets in `.env.local`; never print, stage, or commit them.

## Docker / WSL / local test infrastructure conventions

This machine uses Windows + WSL2 + Docker Desktop. Multiple repositories and multiple Codex/Claude agents may run Docker workloads concurrently.

When adding or modifying Docker or Docker Compose configuration:

- Prefer project-local Compose files in the repository root, such as `compose.yaml`, `compose.dev.yaml`, and `compose.test.yaml`.
- Do not make global Docker Desktop, daemon, WSL, or system-level changes unless explicitly asked.
- Do not use fixed `container_name` unless there is a strong project-specific reason.
- Use Compose project scoping. Prefer a top-level `name: ${COMPOSE_PROJECT_NAME:-<project-slug>}`.
- Prefer Docker's default project-scoped network. Do not create external/global networks unless required.
- Avoid publishing host ports unless the application or tests genuinely need access via localhost from the WSL host or Windows host.
- If host ports are needed, bind to `127.0.0.1`, make the port configurable through `.env`, and use a high default port unlikely to collide with other projects.
- Prefer service-to-service communication by Compose service name, for example `postgres:5432`, `redis:6379`, `mysql:3306`, rather than localhost where possible.
- Prefer Docker named volumes for persistent local development databases.
- Prefer `tmpfs` for disposable test databases when tests recreate schema/data and persistence is not needed.
- Never bind-mount database data directories to Windows paths such as `/mnt/c/...` or `/mnt/d/...`.
- For WSL/Docker-heavy projects, assume the repository should live under `/home/rasmus/repos/...`, not `/mnt/c/...` or `/mnt/d/...`.
- Add or update `AGENTS.md`, `README`, or `docs/local-docker.md` with the correct commands for starting, testing, and tearing down local Docker services.
- Add `.env.example` for configurable ports and credentials. Do not commit real secrets.
- Add `.env` to `.gitignore` if it is not already ignored.

## Epic-bounded BMAD Loop workflow

These rules are binding for every sprint run:

- Run only one `bmad-loop` process at a time.
- Before launching `bmad-loop`, require a clean worktree and a successful `bmad-loop validate --project "$PWD"`.
- Restrict every sprint run to exactly one epic. First run this dry-run command:

  ```bash
  bmad-loop run --project "$PWD" --epic <epic-number> --dry-run
  ```

- Inspect the dry-run output and verify that every selected story belongs to the intended epic before continuing.
- Only after that verification, run the same epic-bounded command without `--dry-run`:

  ```bash
  bmad-loop run --project "$PWD" --epic <epic-number>
  ```

- Never run an unfiltered `bmad-loop run`.
- Never continue automatically into the next epic.
- Already-completed stories must be skipped.
- Keep the existing per-epic quality gate policy: `.bmad-loop/policy.toml` must retain `[gates] mode = "per-epic"`; do not weaken or bypass it.
- After completing the selected epic, report the results and stop for human review.
