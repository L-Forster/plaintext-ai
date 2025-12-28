export interface Paper {
  arxiv_id: string;
  title: string;
  summary: string;
  authors: string[];
  journal?: string;
  citations?: number;
  doi?: string;
  url?: string;
  keywords?: string[];
  embedding?: string; // Stored as a JSON string
  fieldOfStudy?: string[];
  publicationDate?: Date;
  similarity?: number; // Similarity score for related papers (0-1)
  published?: string; // Published date as string
}

export interface PaperConnection {
  id: number;
  sourceId: number;
  targetId: number;
  strength: number;
}
