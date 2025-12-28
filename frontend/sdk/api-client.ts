/**
 * PlaintextAI API Client
 * 
 * Use this to call the PlaintextAI backend from your own app.
 */

export interface ApiClientConfig {
  baseUrl?: string;
  openaiApiKey?: string;
}

export interface Paper {
  arxiv_id: string;
  title: string;
  summary: string;
  authors: string[];
  published: string;
  citations?: number;
  journal: string;
  doi: string;
  url: string;
  fieldOfStudy: string[];
}

export interface Claim {
  id: string;
  text: string;
}

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    id: string;
    label: string;
    toolType: string;
    config: Record<string, unknown>;
    status: string;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

export function createApiClient(config: ApiClientConfig = {}) {
  const baseUrl = config.baseUrl || 'http://localhost:3000';

  async function post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(error);
    }
    return res.json();
  }

  return {
    /**
     * Search for academic papers via Semantic Scholar
     */
    async searchPapers(query: string, options?: { limit?: number; yearFrom?: number; yearTo?: number }) {
      return post<{ papers: Paper[]; total: number }>('/api/source-finder/search', {
        query,
        limit: options?.limit || 10,
        yearFrom: options?.yearFrom,
        yearTo: options?.yearTo,
      });
    },

    /**
     * Extract claims from text
     * Model is automatically selected based on task complexity
     */
    async extractClaims(text: string) {
      return post<{ claims: Claim[] }>('/api/claim-extractor/extract', {
        prompt: text,
      });
    },

    /**
     * Check text for contradictions
     * Model is automatically selected based on task complexity
     */
    async checkContradictions(text: string) {
      return post<{ claims: Claim[]; summary: string }>('/api/contradiction-check/check', {
        text,
      });
    },

    /**
     * Generate a literature review
     */
    async generateLiteratureReview(options: {
      topic: string;
      type?: 'narrative' | 'systematic' | 'meta-analysis' | 'scoping' | 'critical';
      depth?: 'brief' | 'standard' | 'comprehensive';
      tone?: 'academic' | 'formal' | 'critical' | 'neutral';
      papers?: Paper[];
    }) {
      return post<{ review: string; papers: Paper[] }>('/api/literature-review/generate', {
        reviewTopicScope: options.topic,
        reviewType: options.type || 'narrative',
        reviewDepthLength: options.depth || 'standard',
        reviewTone: options.tone || 'academic',
        papers: options.papers || [],
      });
    },

    /**
     * Format references in a citation style
     */
    async formatReferences(references: string, style?: 'APA' | 'MLA' | 'Chicago' | 'Harvard' | 'IEEE') {
      return post<{ formattedReferences: string }>('/api/reference-management/format', {
        referencesInput: references,
        citationStyle: style || 'APA',
      });
    },

    /**
     * Generate a workflow DAG from natural language
     */
    async generateWorkflow(description: string, existingNodeCount?: number) {
      return post<{ nodes: WorkflowNode[]; edges: WorkflowEdge[] }>('/api/generate-workflow-from-text', {
        userInput: description,
        existingNodeCount: existingNodeCount || 0,
      });
    },
  };
}

