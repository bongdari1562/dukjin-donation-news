import { defineCollection, z } from "astro:content";

const newsletter = defineCollection({
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    thumbnail: z.string(),
    url: z.string().url(),
  }),
});

export const collections = { newsletter };
