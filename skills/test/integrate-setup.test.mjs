// setup.mjs: the install command per package manager and workspace, the
// versions it picks, where the theme goes, and its CDN plan.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { installed, node, nodeJson, project } from './integrate-helpers.mjs';

const setup = (cwd, ...args) => nodeJson('setup.mjs', ['--cwd', cwd, '--json', ...args]);
const react = {
  name: 'app',
  private: true,
  dependencies: { react: '^19.1.0', 'react-dom': '^19.1.0' },
};

describe('setup.mjs', () => {
  it('installs the wrapper, the element and a theme at the latest release', async () => {
    const dir = project(undefined, {
      'package.json': react,
      'pnpm-lock.yaml': '',
      'src/main.tsx': '',
    });
    const plan = await setup(dir);
    assert.equal(plan.command, 'pnpm add @argus-table/react argus-table @argus-table/themes');
    assert.equal(plan.framework, 'react');
    assert.equal(plan.version, 'latest');
    assert.deepEqual(plan.theme, {
      name: 'default',
      file: 'src/main.tsx',
      statement: "import '@argus-table/themes/default.css';",
      alreadyPresent: false,
      note: 'Load one theme per page, after the table; it loads no fonts.',
    });
    assert.deepEqual(plan.imports, [
      "import { ArgusTable, type ReactColumnDef } from '@argus-table/react';",
    ]);
  });

  it('matches the installed version, or upgrades every package together', async () => {
    const current = project(undefined, {
      'package.json': react,
      ...installed({ 'argus-table': '1.1.2', '@argus-table/react': '1.1.2' }),
    });
    const plan = await setup(current, '--addons', 'header-menu,export');
    assert.equal(
      plan.command,
      'npm install @argus-table/react@1.1.2 argus-table@1.1.2 @argus-table/themes@1.1.2 @argus-table/header-menu@1.1.2 @argus-table/export@1.1.2',
    );
    assert.equal(plan.plugins, '[tableExport(), headerMenu()]');

    const old = project(undefined, {
      'package.json': {
        ...react,
        dependencies: { ...react.dependencies, '@argus-table/vue': '^1.0.0' },
      },
      ...installed({ 'argus-table': '1.0.0', '@argus-table/vue': '1.0.0' }),
    });
    const upgrade = await setup(old, '--theme', 'none');
    assert.equal(
      upgrade.command,
      'npm install @argus-table/react@^1.1.0 argus-table@^1.1.0 @argus-table/vue@^1.1.0',
    );
    assert.match(upgrade.versionNote, /upgrade every argus-table package together/);
    assert.equal(upgrade.theme, null);

    const pinned = await setup(
      project(undefined, { 'package.json': react }),
      '--version',
      '1.2.0',
      '--pm',
      'bun',
    );
    assert.equal(
      pinned.command,
      'bun add @argus-table/react@1.2.0 argus-table@1.2.0 @argus-table/themes@1.2.0',
    );
  });

  it('installs into a workspace with each package manager', async () => {
    const workspace = (pm, files) =>
      project(undefined, {
        'package.json': { name: 'root', private: true, workspaces: ['apps/*'] },
        'apps/web/package.json': { name: 'web', dependencies: { vue: '^3.5.0' } },
        ...files,
      });
    const cases = [
      [
        'npm',
        { 'package-lock.json': '{}' },
        'npm install @argus-table/vue argus-table @argus-table/themes -w apps/web',
      ],
      [
        'yarn',
        { 'yarn.lock': '' },
        'yarn workspace web add @argus-table/vue argus-table @argus-table/themes',
      ],
      [
        'bun',
        { 'bun.lock': '{}' },
        'bun add --cwd apps/web @argus-table/vue argus-table @argus-table/themes',
      ],
    ];
    for (const [pm, files, command] of cases) {
      const dir = workspace(pm, files);
      assert.equal((await setup(join(dir, 'apps/web'))).command, command, pm);
    }
    const pnpm = project('monorepo-pnpm');
    const plan = await setup(join(pnpm, 'apps/web'));
    // 1.0.0 and 1.1.0 locked: everything moves to the newer one.
    assert.equal(
      plan.command,
      'pnpm --filter web add @argus-table/react@1.1.0 argus-table@1.1.0 @argus-table/themes@1.1.0',
    );
  });

  it('adds lit for the add-ons when the package manager skips peers', async () => {
    const berry = project(undefined, {
      'package.json': react,
      'yarn.lock': '',
      '.yarnrc.yml': 'nodeLinker: node-modules\n',
    });
    const plan = await setup(berry, '--addons', 'formulas');
    assert.equal(
      plan.command,
      'yarn add @argus-table/react argus-table @argus-table/themes @argus-table/formulas lit@^3.3.0',
    );
    const npm = await setup(project(undefined, { 'package.json': react }), '--addons', 'formulas');
    assert.ok(!npm.command.includes('lit'));
  });

  it('puts the theme where the framework loads global CSS', async () => {
    const next = project('next-app-aggrid');
    const nextPlan = await setup(next);
    assert.equal(nextPlan.theme.file, 'app/layout.tsx');
    assert.match(
      nextPlan.notes[0],
      /Server Component may render <ArgusTable> only with serializable props/,
    );

    const angular = await setup(project('angular-material-primeng'));
    assert.equal(angular.framework, 'angular');
    assert.equal(angular.theme.file, 'src/styles.scss');
    assert.equal(angular.theme.statement, "@import '@argus-table/themes/default.css';");

    const nuxt = project(undefined, {
      'package.json': { dependencies: { nuxt: '^3.17.0', vue: '^3.5.0' } },
      'nuxt.config.ts': 'export default defineNuxtConfig({})',
    });
    const nuxtPlan = await setup(nuxt, '--theme', 'material');
    assert.equal(
      nuxtPlan.theme.statement,
      "css: ['@argus-table/themes/material.css'] (in defineNuxtConfig)",
    );
    assert.match(nuxtPlan.notes[0], /<ClientOnly>/);
  });

  it('plans a page without a bundler', async () => {
    const plan = await setup(project('html-tables'), '--cdn', '--addons', 'header-menu');
    assert.equal(plan.command, null);
    assert.deepEqual(plan.cdn, [
      '<script type="module" src="https://cdn.jsdelivr.net/npm/argus-table/dist/cdn/argus-table.js"></script>',
      '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@argus-table/themes/dist/default.css" />',
      '<script type="module">import { headerMenu } from \'https://cdn.jsdelivr.net/npm/@argus-table/header-menu/+esm\'; /* table.plugins = [headerMenu()] */</script>',
    ]);
  });

  it('prints a plan as text, and refuses bad options', async () => {
    const text = await node('setup.mjs', ['--cwd', project(undefined, { 'package.json': react })]);
    assert.equal(text.code, 0);
    assert.match(
      text.stdout,
      /^Install:\n {2}npm install @argus-table\/react argus-table @argus-table\/themes$/m,
    );
    assert.match(text.stdout, /Then check: node .*check\.mjs/);
    for (const args of [
      ['--theme', 'neon'],
      ['--addons', 'charts'],
      ['--framework', 'svelte'],
      ['--version', 'next'],
      ['--cwd'],
    ]) {
      assert.equal((await node('setup.mjs', args)).code, 2, args.join(' '));
    }
    assert.equal((await node('setup.mjs', ['--cwd', project(undefined)])).code, 1);
  });
});
