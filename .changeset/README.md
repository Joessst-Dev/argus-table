# Changesets

Every pull request that changes a published package adds a changeset: run `pnpm changeset`, pick the packages and the bump, and describe the change from a user's point of view. The text becomes the changelog entry.

Docs-, CI- and tooling-only pull requests don't need one; label them `no-changeset`.

Merged changesets collect in a "Version packages" pull request. Merging that pull request publishes to npm.
