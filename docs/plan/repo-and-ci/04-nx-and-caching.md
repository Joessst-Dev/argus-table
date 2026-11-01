# Nx: task graph, affected and caching

[← Back to contents](../README.md)

Nx sits on top of the pnpm workspace in package-based mode: it orders tasks, skips unchanged work and caches results, without changing the folder layout.

- `nx init` adds `nx.json`; inferred tasks pick up targets from the Vite, Vitest, Playwright and Storybook configs, so few targets are written by hand.
- `targetDefaults`: `build` depends on `^build`; wrapper generation depends on `table:build` (it needs the manifest); `e2e`, `visual`, `examples` and Storybook depend on `^build`.
- Named inputs: `production` excludes tests, stories and markdown. The `visual` target lists theme CSS, table source and the Playwright image tag, so a cached pass can't hide a real regression.
- Expect most code PRs to touch `argus-table`, which everything depends on; `affected` mainly saves time on theme-, docs- and CI-only PRs, and caching saves the rest.
- `release.yml` builds with `--skip-nx-cache`, so published files never come from a cache.
- Root scripts (`pnpm test`, `pnpm build`, …) stay as thin aliases, so contributors don't need to learn Nx.

## Remote cache: Nx Cloud terms (checked 28 Oct 2026)

| Plan | Cost | Limits | Fit for this repo |
| --- | --- | --- | --- |
| Hobby | Free, no card | 50,000 credits/month, 5 contributors, 10 concurrent CI connections; Nx Cloud features switch off when credits run out, until the monthly reset | Fine to start; one outside estimate puts 50k credits at roughly 100 pipeline runs/month |
| Open source | Free | For "qualifying open source organizations"; criteria aren't published; apply through Nx's contact form | Apply once the repo is public and active |
| Self-hosted cache | Free | You run the storage (e.g. an S3 bucket) and pay for it | Fallback if Nx Cloud terms ever stop fitting |

## Cache security rules for a public repo

From Nx's cache security docs:

- Read-write token only as a GitHub secret available on `main`. Pull requests use a read-only token: they read the shared cache but write only to an isolated cache, so a PR can't poison it.
- Never put an access token in `nx.json`; it's visible to anyone who can read the repo.
- GitHub doesn't pass repository secrets to workflows run from fork PRs, so outside contributors' PRs run with the local cache only: correct, just slower.

**Decision:** Phase 0 uses Nx with local caching only (no account, no tokens). Connect Nx Cloud on the Hobby plan when CI regularly takes over ~10 minutes, and apply for the open-source plan at public launch.

Sources: [Nx Cloud plans FAQ](https://nx.dev/docs/features/ci-features) · [Nx cache security](https://nx.dev/docs/concepts/ci-concepts/cache-security) · [Nx: self-hosted caching free](https://nx.dev/blog/introducing-nx-powerpack) · [credits estimate (Cachely, third party)](https://cachely.dev/nx-cloud-alternative)
