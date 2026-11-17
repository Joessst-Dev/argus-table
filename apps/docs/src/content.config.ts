import { basename } from 'node:path';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      // The release a page's feature arrived in: a "Since" or "Coming in" badge.
      extend: z.object({
        since: z
          .string()
          .regex(/^\d+\.\d+$/)
          .optional(),
      }),
    }),
  }),
  // The integrate skill's migration guides, read where they are
  // (src/lib/migration.ts rewrites their links): `tanstack`, …, `gaps`.
  migration: defineCollection({
    loader: glob({
      base: '../../skills/argus-table-integrate/references',
      pattern: ['migrate/*.md', 'gaps.md'],
      generateId: ({ entry }) => basename(entry, '.md'),
    }),
  }),
};
