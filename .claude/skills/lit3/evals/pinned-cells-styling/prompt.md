---
tags: [skill-creator]
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

We need the rendering + styles for pinned columns (left and right) in the body. The last pinned column on each side should get a shadow edge that a theme can restyle or remove. Write the render function and the styles for packages/table/src, assume column offsets come from the table model.
