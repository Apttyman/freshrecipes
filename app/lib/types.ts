// app/lib/types.ts
export type Section = { heading: string; html: string };

export type Recipe = {
  id: number | string;
  title: string;
  author?: string;
  imageUrl?: string | null;
  sections: Section[];
};
