// Custom Elements Manifest: the single source for Storybook docs and
// controls, the generated framework wrappers and editor hints.

/** Keep private and `#private` members out of the manifest: they are not API. */
function dropPrivateMembers() {
  return {
    name: 'argus-drop-private-members',
    packageLinkPhase({ customElementsManifest }) {
      for (const mod of customElementsManifest.modules) {
        for (const decl of mod.declarations ?? []) {
          if (!decl.members) continue;
          decl.members = decl.members.filter(
            (m) => m.privacy !== 'private' && !m.name.startsWith('#'),
          );
        }
      }
    },
  };
}

export default {
  globs: ['src/**/*.ts'],
  exclude: ['src/**/*.test.ts', 'src/**/*.stories.ts'],
  outdir: 'dist',
  litelement: true,
  plugins: [dropPrivateMembers()],
};
