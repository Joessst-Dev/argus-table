import { defineCollection } from 'astro:content';
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
};
