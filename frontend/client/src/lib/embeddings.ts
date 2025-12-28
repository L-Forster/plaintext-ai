// This file contains utilities for working with embeddings in the frontend
// In a real-world application, embedding generation would typically be done on the backend

import { Paper } from "@/types/paper";

// Parse embedding string back to array
export function parseEmbedding(embeddingString: string | undefined): number[] {
  if (!embeddingString) return [];
  try {
    return JSON.parse(embeddingString);
  } catch (error) {
    console.error("Error parsing embedding:", error);
    return [];
  }
}

// Calculate cosine similarity between two embeddings
export function cosineSimilarity(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length === 0 || embedding2.length === 0 || embedding1.length !== embedding2.length) {
    return 0;
  }
  
  // Calculate dot product
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    magnitude1 += embedding1[i] * embedding1[i];
    magnitude2 += embedding2[i] * embedding2[i];
  }
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }
  
  return dotProduct / (magnitude1 * magnitude2);
}

// Find similar papers based on embeddings
export function findSimilarPapers(targetPaper: Paper, allPapers: Paper[], maxResults = 5): Paper[] {
  const targetEmbedding = parseEmbedding(targetPaper.embedding);
  
  // Calculate similarity scores
  const withSimilarity = allPapers
    .filter(paper => paper.arxiv_id !== targetPaper.arxiv_id) // Exclude the target paper
    .map(paper => ({
      paper,
      similarity: cosineSimilarity(targetEmbedding, parseEmbedding(paper.embedding))
    }))
    .sort((a, b) => b.similarity - a.similarity); // Sort by similarity (descending)
  
  // Return top results
  return withSimilarity.slice(0, maxResults).map(item => item.paper);
}
