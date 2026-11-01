# Contribution and release pipeline

[← Back to contents](../README.md)

Releases are batched: merged changes collect in a "Version packages" PR, and publishing happens only when you merge it.

**Every change passes CI and review; you decide when a release goes out.**

```mermaid
flowchart LR
    pr["Pull request<br/>from a fork or branch"] --> ci["ci.yml checks<br/>tests, visual, a11y"]
    ci --> ok{"Green and reviewed?"}
    ok -- no --> fix["Fix and push<br/>to the same PR"]
    fix --> pr
    ok -- yes --> merge["Squash merge<br/>into main"]
    merge --> rel["release.yml<br/>updates the Version PR"]
    rel --> you["You merge<br/>the Version PR"]
    you --> pub["Publish to npm<br/>OIDC + GitHub release"]

    classDef main stroke-width:2px
    class pub main
```

Every merge to `main` also redeploys Storybook through `docs.yml`.
