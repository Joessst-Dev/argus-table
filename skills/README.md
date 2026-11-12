# Agent skills

Skills that teach coding agents (Claude Code, Codex, Cursor and others that read `SKILL.md`) to work with argus-table.

## `argus-table-theme`

Makes an argus-table theme from what you give your agent: brand colours, a font, a feel ("flat and dense", "rounded and soft"), or the URL of your website. The agent reads your site's colours, fonts and corner radii, writes a theme draft and gives you a link to the [theme creator](https://joessst-dev.github.io/argus-table/?path=/story/themes-theme-creator--creator). The link opens with your theme on a live table in light and dark. There you check WCAG contrast, adjust anything and download the CSS.

Ask for example:

- "Make an argus-table theme in our brand colours: primary `#0b5fff`, dark navy text, Inter."
- "Theme the table to match https://example.com."
- "Our app has a dark mode. Give the table a theme that fits both, based on `src/styles/tokens.css`."

The skill runs two small Node scripts (Node 18 or later, no dependencies). `extract-palette.mjs` reads a website's colours, fonts and radii. `theme-link.mjs` checks the draft and makes the link. Nothing is sent anywhere except the request for the website you name. The theme lives in the link's `#` fragment, which browsers don't send to the server.

## Install

**Claude Code**, as a plugin:

```text
/plugin marketplace add Joessst-Dev/argus-table
/plugin install argus-table@argus-table
```

On Claude Code 2.1.275 or later, one step does both:

```text
/plugin install argus-table --marketplace Joessst-Dev/argus-table
```

The skill is then `/argus-table:argus-table-theme`. Claude also uses it on its own when you ask for a table theme.

**Any agent**, with the [`skills`](https://github.com/vercel-labs/skills) CLI:

```bash
npx skills add Joessst-Dev/argus-table --skill argus-table-theme
```

Add `-a claude-code`, `-a codex`, `-a cursor`, … to pick the agent, and `-g` to install for your user rather than the project.

**[faehigkeiten](https://github.com/Joessst-Dev/faehigkeiten):**

```bash
fgk install Joessst-Dev/argus-table argus-table-theme
```

**By hand:** copy [`argus-table-theme/`](argus-table-theme) into your agent's skills folder, for example `.claude/skills/argus-table-theme/` in your project.
