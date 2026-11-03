# Security policy

## Supported versions

Argus Table has not had a release yet. Once it does, security fixes go into the latest minor version only.

| Version            | Supported |
| ------------------ | --------- |
| Latest `0.x` minor | Yes       |
| Older versions     | No        |

## Reporting a vulnerability

Please **don't** open a public issue for security problems.

Report it privately through GitHub instead: open the repository's **Security** tab and choose **Report a vulnerability**, or go directly to the [new advisory form](https://github.com/Joessst-Dev/argus-table/security/advisories/new).

Please include:

- the affected package and version;
- what an attacker could do, and under which conditions;
- steps or a minimal reproduction;
- a suggested fix, if you have one.

## What to expect

- An acknowledgement within 7 days.
- An assessment and, if confirmed, a plan for a fix and a release.
- Credit in the security advisory, if you'd like it.

Please give us a reasonable amount of time to release a fix before disclosing the issue publicly.

## Scope

Particularly relevant for this project:

- **Formula columns** (`@argus-table/formulas`): any way for a user-entered formula to run arbitrary JavaScript, read properties outside its row, or escape the function allowlist.
- **Cell rendering**: any way for row data to be rendered as HTML or script without the host app explicitly opting in.
- **Supply chain**: problems with how packages are built or published.

Bugs in a host application's own code, or in dependencies that are already reported upstream, are out of scope here.
