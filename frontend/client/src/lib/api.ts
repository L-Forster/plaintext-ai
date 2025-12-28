/**
 * API client for interacting with the backend
 */

import { API_URL, SEMANTIC_SCHOLAR_API_KEY } from './env'; // Added SEMANTIC_SCHOLAR_API_KEY
import * as d3 from 'd3'; // Import d3 to use its types
import { Paper } from '../types/paper'; // Import the Paper type

// Use relative path for API calls, assuming frontend is served from same domain or proxied
const API_BASE_URL = API_URL;

/**
 * Types for graph data
 */
export interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  color?: string;
  size?: number;
  paper?: Paper;
  // D3 properties are from extending SimulationNodeDatum
}

export interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  label?: string;
  color?: string;
  weight?: number;
  value?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface RelatedPapersResponse {
  paper: Paper;
  related: Paper[];
}

export interface PaginatedResponse<T> {
  papers: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}



/**
 * Backend to frontend data transformation
 */
function transformPaper(apiPaper: any): Paper {
  if (!apiPaper || typeof apiPaper !== 'object') {
    console.warn('transformPaper received invalid data:', apiPaper);
    return {
      arxiv_id: '', title: 'Invalid Paper Data', summary: '', authors: [], published: ''
    };
  }

  return {
    arxiv_id: apiPaper.arxiv_id || apiPaper.paperId || apiPaper.id || '', // paperId is common from S2
    title: apiPaper.title || "",
    summary: apiPaper.summary || apiPaper.abstract || "",
    authors: apiPaper.authors?.map((author: any) => author.name) || [], // S2 authors are objects with 'name'
    similarity: apiPaper.similarity,
    published: apiPaper.published || apiPaper.publicationDate || apiPaper.year?.toString() || '', // S2 uses publicationDate and year
    citations: apiPaper.citationCount, // S2 uses citationCount
    journal: apiPaper.venue || '', // S2 uses venue
    doi: apiPaper.externalIds?.DOI || apiPaper.doi || '', // S2 externalIds can contain DOI
    url: apiPaper.url || (apiPaper.externalIds?.ArXiv ? `https://arxiv.org/abs/${apiPaper.externalIds.ArXiv}` : ''), // Construct arXiv URL if available
    keywords: apiPaper.keywords, // May not be directly available, S2 uses fieldsOfStudy
    fieldOfStudy: apiPaper.fieldsOfStudy || [], // S2 uses fieldsOfStudy (array of strings)
  };
}

// New transformation function specific to Semantic Scholar API response
function transformSemanticScholarPaper(s2Paper: any): Paper {
  if (!s2Paper || typeof s2Paper !== 'object') {
    console.warn('transformSemanticScholarPaper received invalid data:', s2Paper);
    return {
      arxiv_id: '', title: 'Invalid Paper Data', summary: '', authors: [], published: ''
    };
  }
  return {
    arxiv_id: s2Paper.externalIds?.ArXiv || s2Paper.paperId || '',
    title: s2Paper.title || "",
    summary: s2Paper.abstract || "",
    authors: s2Paper.authors?.map((author: { name: string }) => author.name) || [],
    published: s2Paper.publicationDate || (s2Paper.year ? s2Paper.year.toString() : ''),
    citations: s2Paper.citationCount,
    journal: s2Paper.venue || "",
    doi: s2Paper.externalIds?.DOI || "",
    url: s2Paper.url || (s2Paper.externalIds?.ArXiv ? `https://arxiv.org/abs/${s2Paper.externalIds.ArXiv}` : ''),
    fieldOfStudy: s2Paper.fieldsOfStudy || [],
    // similarity, keywords might not be directly available or need different handling
  };
}

// --- API Functions ---

export const fetchPapers = async (page = 1, limit = 50): Promise<PaginatedResponse<Paper>> => {
  const headers = { 'Content-Type': 'application/json' };
  const url = `${API_BASE_URL}/papers?page=${page}&limit=${limit}`;
  const response = await fetch(url, { headers });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
    console.error(`Error fetching papers: ${response.status}`, errorData);
    throw new Error(errorData.message || `Failed to fetch papers: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data || !data.papers || !Array.isArray(data.papers)) {
    console.error('Invalid papers data format received:', data);
    throw new Error("Invalid papers data format received from API.");
  }
  return { ...data, papers: data.papers.map(transformPaper) };
};

export const fetchPaper = async (paperId: string | number): Promise<Paper> => {
  const headers = { 'Content-Type': 'application/json' };
  const url = `${API_BASE_URL}/papers/${paperId}`;
  const response = await fetch(url, { headers });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
    console.error(`Error fetching paper ${paperId}: ${response.status}`, errorData);
    throw new Error(errorData.message || `Failed to fetch paper ${paperId}: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data) { // Basic check for data, specific checks depend on expected Paper structure
    console.error('Invalid paper data format received for paperId:', paperId, data);
    throw new Error("Invalid paper data format received from API.");
  }
  return transformPaper(data);
};

export const fetchRelatedPapers = async (paperId: string | number, limit = 5): Promise<RelatedPapersResponse> => {
  const headers = { 'Content-Type': 'application/json' };
  const url = `${API_BASE_URL}/papers/${paperId}/related?limit=${limit}`;
  const response = await fetch(url, { headers });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
    console.error(`Error fetching related papers for ${paperId}: ${response.status}`, errorData);
    throw new Error(errorData.message || `Failed to fetch related papers for ${paperId}: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data || !data.paper || !Array.isArray(data.related)) {
    console.error('Invalid related papers data format received for paperId:', paperId, data);
    throw new Error("Invalid related papers data format received from API.");
  }
  return { paper: transformPaper(data.paper), related: data.related.map(transformPaper) };
};

/**
 * Fetches graph data for visualization.
 */
export const fetchGraphData = async (
  centerId: string,
  depth: number = 1,
  maxNodes: number = 50
): Promise<GraphData> => {
  const url = `${API_BASE_URL}/graph?center_node=${centerId}&depth=${depth}&max_nodes=${maxNodes}`; // Changed URL to relative path
  // console.log(`Fetching graph data (no auth): ${url}`);

  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' } // Set Content-Type
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
      if (response.status === 429) {
        throw new Error(errorData.message || "You've reached the daily limit of graph explorations for the free tier.");
      } else {
        throw new Error(errorData.message || `Error fetching graph data: ${response.statusText}`);
      }
    }
    const data = await response.json();
    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
      console.error('Invalid graph data format received:', data);
      throw new Error("Invalid graph data format received from API.");
    }
    return data as GraphData;
  } catch (error: any) {
    console.error('Fetch graph data error:', error);
    throw error; // Rethrow for useQuery
  }
};

/**
 * Search papers by title or content with pagination.
 * Uses OPTIONAL authentication: sends token if logged in, proceeds anonymously otherwise.
 * Assumes backend handles anonymous requests and applies free-tier limits.
 */
export const searchPapers = async (query: string, page = 1, limit = 10): Promise<PaginatedResponse<Paper>> => {
  try {
    const headers = { 'Content-Type': 'application/json' };
    const url = `${API_BASE_URL}/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`;

    const response = await fetch(url, {
      headers,
      method: 'GET',
    });

    // Handle response status codes
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})); // Try to get error message from body
      console.error(`Search API error - Status: ${response.status} ${response.statusText}`, errorData);

      if (response.status === 429) {
        // Rate limit likely applies to both authenticated and anonymous users differently
        throw new Error(errorData.message || "Search rate limit exceeded. Please try again later.");
      } else if (response.status === 401) {
        // This would likely only happen if an INVALID/EXPIRED token was sent.
        throw new Error("Invalid authentication. Try refreshing the page or signing in again.");
      } else {
        throw new Error(errorData.message || "Search failed. Please try again later.");
      }
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.papers)) {
      console.error('Invalid search result format received:', data);
      throw new Error("Invalid search result format received.");
    }

    // Transform data to match expected format if needed 
    return { ...data, papers: data.papers.map(transformPaper) };
  } catch (error: any) {
    console.error('Search papers error:', error);
    throw error; // Rethrow for useQuery
  }
};

/**
 * Search papers using the Semantic Scholar API with advanced features
 */
export const searchSemanticScholar = async (
  query: string,
  page = 1,
  limit = 10,
  filters?: { yearFrom?: number; yearTo?: number; fieldOfStudy?: string[], minCitations?: number }
): Promise<PaginatedResponse<Paper>> => {
  // console.log(`Searching Semantic Scholar for: "${query}"`, filters);

  const S2_API_BASE_URL = 'https://api.semanticscholar.org/graph/v1';
  const fieldsToRequest = [
    'paperId', 'externalIds', 'url', 'title', 'abstract',
    'venue', 'year', 'publicationDate', 'authors.name', 'citationCount', 'fieldsOfStudy'
  ].join(',');
  const offset = (page - 1) * limit;

  // Build query parameters
  const queryParams = new URLSearchParams({
    query: encodeURIComponent(query),
    offset: offset.toString(),
    limit: limit.toString(),
    fields: fieldsToRequest,
  });

  if (filters) {
    if (filters.yearFrom && filters.yearTo) {
      queryParams.append('year', `${filters.yearFrom}-${filters.yearTo}`);
    } else if (filters.yearFrom) {
      queryParams.append('year', `${filters.yearFrom}-`);
    } else if (filters.yearTo) {
      queryParams.append('year', `-${filters.yearTo}`);
    }
    if (filters.fieldOfStudy && filters.fieldOfStudy.length > 0) {
      // Semantic Scholar API expects fieldsOfStudy as a comma-separated string for some endpoints,
      // but for /paper/search it might also accept multiple query params or a specific format.
      // Assuming it might take it as a single comma-separated value based on common patterns.
      // The S2 docs should be consulted for the exact format if this doesn't work.
      // For now, let's assume it does not directly support multi-select fieldOfStudy in query params this way.
      // This part may need adjustment based on S2 capabilities or might need client-side filtering for fieldsOfStudy.
      // console.warn("fieldOfStudy filter is not fully implemented for S2 API direct call in this version.");
    }
    // minCitations usually requires client-side filtering for S2 paper search unless a specific API param exists.
  }

  try {
    // Optional: Use getOptionalAuthHeaders if you still want to pass your app's auth token
    // to your own backend proxy, but for direct S2 call, it's not for S2 authentication.
    // const appAuthHeaders = await getOptionalAuthHeaders(); 

    const s2Headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (SEMANTIC_SCHOLAR_API_KEY) {
      s2Headers['x-api-key'] = SEMANTIC_SCHOLAR_API_KEY;
      // console.log("Using Semantic Scholar API Key.");
    } else {
      console.warn("Semantic Scholar API Key (VITE_SEMANTIC_SCHOLAR_API_KEY) is not set. Requests might be rate-limited or fail.");
    }

    // Construct the URL for the public Semantic Scholar API
    const searchUrl = `${S2_API_BASE_URL}/paper/search?${queryParams.toString()}`;

    // console.log(`Sending request to Semantic Scholar: ${searchUrl}`);

    const response = await fetch(searchUrl, {
      headers: s2Headers,
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
      console.error(`Semantic Scholar API error: ${response.status} ${response.statusText}`, errorData);

      if (response.status === 401 || response.status === 403) {
        throw new Error(errorData.message || "Authentication failed with Semantic Scholar API. Check your API key.");
      } else if (response.status === 429) {
        throw new Error(errorData.message || "Rate limit exceeded with Semantic Scholar API. Please try again later.");
      } else {
        throw new Error(errorData.message || `Search failed with Semantic Scholar API: ${response.statusText}`);
      }
    }

    const s2Data = await response.json();

    if (!s2Data || typeof s2Data.total === 'undefined' || !Array.isArray(s2Data.data)) {
      console.error('Invalid Semantic Scholar search result format:', s2Data);
      // If total is 0 and data is empty, it's a valid no-results response
      if (s2Data && s2Data.total === 0 && s2Data.data && s2Data.data.length === 0) {
        return { papers: [], total: 0, page, limit, pages: 0 };
      }
      throw new Error("Invalid search result format received from Semantic Scholar API.");
    }

    const papers = s2Data.data.map(transformSemanticScholarPaper);
    const totalResults = s2Data.total;
    const totalPages = Math.ceil(totalResults / limit);

    return {
      papers,
      total: totalResults,
      page,
      limit,
      pages: totalPages,
    };

  } catch (error: any) {
    console.error('Semantic Scholar search error:', error);
    throw error; // Rethrow for useQuery to handle
  }
};

export interface LLMSearchResponse { // Duplicating for clarity if not shared via types file
  llmResponseText: string;
  papers: Paper[];
  totalPapers?: number;
  sessionId?: string; // Added for chat memory
  modelId?: string; // Added for model selection - kept for potential future use
}

// Add interfaces for contradiction checker
export interface Evidence {
  id: string;
  text: string;
  source: string;
  doi?: string;
  url?: string;
  contradictionScore: number;
  isContradicting: boolean;
}

export interface Claim {
  id: string;
  text: string;
  contradicted: boolean;
  contradictionScore: number;
  evidences: Evidence[];
}

export interface ContradictionCheckResponse {
  claims: Claim[];
  summary: string;
}

/**
 * Get LLM-assisted search results using the AI assistant
 */
export const getLLMAssistedSearchResult = async (prompt: string, sessionId?: string, modelId?: string): Promise<LLMSearchResponse> => {
  const effectiveModelId = modelId || 'nineveh'; // Default to nineveh if no modelId is provided
  const url = `api/scholar-ai-query`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ prompt, sessionId, modelId: effectiveModelId })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI assistant query failed: ${response.status}`, errorText);
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || `Error: ${response.statusText}`);
      } catch (e) {
        // If error isn't valid JSON, use the raw text
        throw new Error(`Error ${response.status}: ${errorText || response.statusText}`);
      }
    }

    const responseData = await response.json();
    // console.log("AI assistant response:", responseData);

    // Extract the LLMSearchResponse from the nested data structure
    // The API is returning { success: true, data: { LLMSearchResponse }, creditsRemaining: number }
    if (responseData.success && responseData.data) {
      return responseData.data as LLMSearchResponse;
    } else {
      throw new Error("Invalid API response format");
    }
  } catch (error: any) {
    console.error('AI assistant query error:', error);
    throw error;
  }
};

// New function to test direct Express route
export const testDirectRoute = async (): Promise<{ success: boolean; message: string }> => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const response = await fetch('/api/test-direct-route', {
      method: 'POST',
      headers,
      body: JSON.stringify({ test: "payload" })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Direct route test error: HTTP ${response.status}`, errorBody);
      throw new Error(`HTTP error ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error("Error testing direct route:", err);
    throw err;
  }
};

// Test the router route
export const testRouter = async (): Promise<{ success: boolean; message: string }> => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const response = await fetch('/api/test-no-auth', {
      method: 'POST',
      headers,
      body: JSON.stringify({ test: "router payload" })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Router test error: HTTP ${response.status}`, errorBody);
      throw new Error(`HTTP error ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error("Error testing router route:", err);
    throw err;
  }
};

// Test the direct AI-like route
export const testDirectAiLikeRoute = async (): Promise<{ llmResponseText: string; papers: Paper[]; success: boolean }> => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const response = await fetch('/api/test-like-ai-route', {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt: "test prompt" })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Direct AI-like route test error: HTTP ${response.status}`, errorBody);
      throw new Error(`HTTP error ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error("Error testing direct AI-like route:", err);
    throw err;
  }
};

/**
 * Checks scientific text for claims that may be contradicted by existing research
 */
export const checkContradictions = async (text: string, modelId?: string): Promise<ContradictionCheckResponse> => {
  // console.log(`[API] Sending contradiction check request with model: ${modelId || 'default'}`);

  try {
    // The complete path should be /api/contradiction-check/check based on our server setup
    const response = await fetch('/api/contradiction-check/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        modelId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
      console.error(`[API] Contradiction check error: ${response.status}`, errorData);
      throw new Error(errorData.message || `Failed to check contradictions: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.claims)) {
      console.error('[API] Invalid contradiction check data format received:', data);
      throw new Error("Invalid contradiction check data format received from API.");
    }

    return data as ContradictionCheckResponse;
  } catch (error: any) {
    console.error('[API] Contradiction check error:', error);
    throw error;
  }
};

// Add the new Data Analysis API interfaces and functions:

export interface DataColumn {
  name: string;
  type: 'numeric' | 'categorical' | 'date' | 'unknown';
  values: any[];
  summary: {
    min?: number;
    max?: number;
    mean?: number;
    median?: number;
    mode?: string | number;
    uniqueValues?: number;
    mostCommonValue?: string;
    mostCommonCount?: number;
    missingValues?: number;
  };
}

export interface DataInsight {
  type: 'statistic' | 'correlation' | 'anomaly' | 'trend' | 'summary';
  description: string;
  importance: number;
  relatedColumns?: string[];
}

export interface DataAnalysisResult {
  fileName: string;
  rowCount: number;
  columnCount: number;
  columns: DataColumn[];
  insights: DataInsight[];
  summary: string;
}

/**
 * Analyzes a CSV file and returns structured insights
 */
export const analyzeCSVFile = async (file: File): Promise<DataAnalysisResult> => {
  // console.log(`[API] Analyzing CSV file: ${file.name}`);

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/data-analysis/analyze', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
      console.error(`[API] Data analysis error: ${response.status}`, errorData);
      throw new Error(errorData.message || `Failed to analyze CSV file: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data || !data.fileName || !Array.isArray(data.columns) || !Array.isArray(data.insights)) {
      console.error('[API] Invalid data analysis result format received:', data);
      throw new Error("Invalid data analysis result format received from API.");
    }

    return data as DataAnalysisResult;
  } catch (error: any) {
    console.error('[API] Data analysis error:', error);
    throw error;
  }
};

/**
 * Citation Network API Functions
 */

/**
 * Fetch papers that cite a given paper
 */
export const fetchCitations = async (paperId: string, limit: number = 10): Promise<Paper[]> => {
  const response = await fetch(`/api/citations/${encodeURIComponent(paperId)}/citations?limit=${limit}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
    throw new Error(errorData.message || 'Failed to fetch citations');
  }

  const data = await response.json();
  return data.data || [];
};

/**
 * Fetch papers that a given paper references
 */
export const fetchReferences = async (paperId: string, limit: number = 10): Promise<Paper[]> => {
  const response = await fetch(`/api/citations/${encodeURIComponent(paperId)}/references?limit=${limit}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
    throw new Error(errorData.message || 'Failed to fetch references');
  }

  const data = await response.json();
  return data.data || [];
};

/**
 * Build a citation network graph for a given paper
 */
export const fetchCitationNetwork = async (
  paperId: string,
  depth: number = 1,
  maxNodes: number = 50
): Promise<GraphData> => {
  const response = await fetch(
    `/api/citations/${encodeURIComponent(paperId)}/network?depth=${depth}&maxNodes=${maxNodes}`
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
    throw new Error(errorData.message || 'Failed to build citation network');
  }

  const data = await response.json();
  return data.data || { nodes: [], links: [] };
};
