export type MisLecturasItem = {
  type: "work" | "chapter";
  slug: string;
  title: string;
  bucket?: string | null;
  filePath?: string | null;
  lastPage?: number;
  numPages?: number | null;
  updatedAt: Date;
  coverUrl?: string | null;
  authorName?: string;
  progressRatio?: number | null; // valor entre 0 y 1 cuando hay numPages
  parentWorkSlug?: string | null;
  hasSerializedChapters?: boolean;
  hasPdf?: boolean;
};

export type SerializedFallback = {
  firstSlug?: string;
  firstTitle?: string;
  firstHasPdf?: boolean;
  firstProgressRatio?: number;
};

export type PublishedChapter = {
  slug: string;
  title: string;
  hasPdf: boolean;
  chapter_number: number | null;
  file_type?: string | null;
};