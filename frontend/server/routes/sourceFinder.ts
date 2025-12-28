/**
 * Source Finder Router
 * 
 * Provides endpoints for searching academic sources:
 * 1. Searches Semantic Scholar API for papers
 * 2. Supports filtering by year, citations, etc.
 * 3. Returns structured paper data for the frontend
 */

import { Router, Request, Response } from 'express';
import { Paper } from '../../client/src/types/paper';
import { env } from '../env';

const router = Router();

// Basic interface for S2 paper structure
interface S2Paper {
  paperId: string;
  externalIds?: { ArXiv?: string; DOI?: string };
  url?: string;
  title?: string;
  abstract?: string;
  venue?: string;
  year?: number;
  publicationDate?: string;
  authors?: Array<{ name: string }>;
  citationCount?: number;
  fieldsOfStudy?: string[];
}

// Interface for search filters
interface SearchFilters {
  yearFrom?: number;
  yearTo?: number;
  minCitations?: number;
}

// Transform S2 paper to our Paper type
function transformS2PaperToPaper(s2Paper: S2Paper): Paper {
  return {
    arxiv_id: s2Paper.externalIds?.ArXiv || s2Paper.paperId || '',
    title: s2Paper.title || "",
    summary: s2Paper.abstract || "",
    authors: s2Paper.authors?.map(author => author.name) || [],
    published: s2Paper.publicationDate || (s2Paper.year ? s2Paper.year.toString() : ''),
    citations: s2Paper.citationCount || 0,
    journal: s2Paper.venue || "",
    doi: s2Paper.externalIds?.DOI || "",
    url: s2Paper.url || (s2Paper.externalIds?.ArXiv ? `https://arxiv.org/abs/${s2Paper.externalIds.ArXiv}` : ''),
    fieldOfStudy: s2Paper.fieldsOfStudy || [],
  };
}

// Function to call Semantic Scholar API
async function callSemanticScholarAPI(
  query: string,
  page: number = 1,
  limit: number = 10,
  filters?: SearchFilters
): Promise<{ papers: Paper[], total: number }> {
  const S2_API_BASE_URL = 'https://api.semanticscholar.org/graph/v1';
  const fieldsToRequest = [
    'paperId', 'externalIds', 'url', 'title', 'abstract',
    'venue', 'year', 'publicationDate', 'authors.name', 'citationCount', 'fieldsOfStudy'
  ].join(',');

  // Ensure page and limit are positive integers
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit))); // Cap at 100
  const offset = (safePage - 1) * safeLimit;

  const queryParams = new URLSearchParams({
    query: query.trim(),
    offset: offset.toString(),
    limit: safeLimit.toString(),
    fields: fieldsToRequest,
  });

  // Apply year filters if provided
  if (filters) {
    if (filters.yearFrom && filters.yearTo) {
      // Validate year range
      if (filters.yearFrom <= filters.yearTo) {
        queryParams.append('year', `${filters.yearFrom}-${filters.yearTo}`);
      }
    } else if (filters.yearFrom) {
      queryParams.append('year', `${filters.yearFrom}-`);
    } else if (filters.yearTo) {
      queryParams.append('year', `-${filters.yearTo}`);
    }
  }

  const s2Url = `${S2_API_BASE_URL}/paper/search?${queryParams.toString()}`;

  const s2Headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Academic-Source-Finder/1.0'
  };

  if (env.SERVER_SEMANTIC_SCHOLAR_API_KEY) {
    s2Headers['x-api-key'] = env.SERVER_SEMANTIC_SCHOLAR_API_KEY;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const s2Response = await fetch(s2Url, {
      headers: s2Headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!s2Response.ok) {
      const errorBody = await s2Response.text();
      console.error(`[S2 API Call] Error (${s2Response.status}): ${errorBody}`);

      if (s2Response.status === 429) {
        console.warn(`[S2 API Call] Rate limited by Semantic Scholar. Returning empty results.`);
        return { papers: [], total: 0 };
      }

      if (s2Response.status === 400) {
        throw new Error(`Invalid search query: ${errorBody}`);
      }

      throw new Error(`Semantic Scholar API request failed: ${s2Response.status} ${s2Response.statusText}`);
    }

    const s2Data = await s2Response.json() as { total: number; data: S2Paper[] };

    if (!s2Data || typeof s2Data.total !== 'number' || !Array.isArray(s2Data.data)) {
      throw new Error('Invalid response format from Semantic Scholar API');
    }

    let papers = s2Data.data.map(transformS2PaperToPaper);

    // Apply client-side filtering for citations if needed
    if (filters?.minCitations && filters.minCitations > 0) {
      papers = papers.filter(paper =>
        (paper.citations || 0) >= (filters.minCitations || 0)
      );
    }

    return { papers, total: s2Data.total };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - Semantic Scholar API took too long to respond');
      }
      console.error('[Source Finder] Error searching Semantic Scholar:', error.message);
      throw error;
    }

    console.error('[Source Finder] Unknown error searching Semantic Scholar:', error);
    throw new Error('Unknown error occurred while searching Semantic Scholar');
  }
}

// Input validation function// Input validation function
function validateSearchInput(body: any): {
  isValid: boolean;
  error?: string;
  data?: {
    prompt: string;
    page: number;
    limit: number;
    searchMode: string;
    filters: SearchFilters;
  }
} {
  // Changed 'prompt' to 'query' to match the request body
  const { query, page = 1, limit = 10, searchMode = 'semanticScholar', yearFrom, yearTo, minCitations } = body;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return { isValid: false, error: 'Search query is required and must be a non-empty string' };
  }

  if (query.trim().length > 500) {
    return { isValid: false, error: 'Search prompt is too long (max 500 characters)' };
  }

  const parsedPage = parseInt(page as string, 10);
  const parsedLimit = parseInt(limit as string, 10);

  if (isNaN(parsedPage) || parsedPage < 1) {
    return { isValid: false, error: 'Page must be a positive integer' };
  }

  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    return { isValid: false, error: 'Limit must be between 1 and 100' };
  }

  const filters: SearchFilters = {};

  if (yearFrom !== undefined) {
    const parsedYearFrom = parseInt(yearFrom as string, 10);
    if (isNaN(parsedYearFrom) || parsedYearFrom < 1900 || parsedYearFrom > new Date().getFullYear()) {
      return { isValid: false, error: 'Year from must be a valid year between 1900 and current year' };
    }
    filters.yearFrom = parsedYearFrom;
  }

  if (yearTo !== undefined) {
    const parsedYearTo = parseInt(yearTo as string, 10);
    if (isNaN(parsedYearTo) || parsedYearTo < 1900 || parsedYearTo > new Date().getFullYear()) {
      return { isValid: false, error: 'Year to must be a valid year between 1900 and current year' };
    }
    filters.yearTo = parsedYearTo;
  }

  if (filters.yearFrom && filters.yearTo && filters.yearFrom > filters.yearTo) {
    return { isValid: false, error: 'Year from cannot be greater than year to' };
  }

  if (minCitations !== undefined) {
    const parsedMinCitations = parseInt(minCitations as string, 10);
    if (isNaN(parsedMinCitations) || parsedMinCitations < 0) {
      return { isValid: false, error: 'Minimum citations must be a non-negative integer' };
    }
    filters.minCitations = parsedMinCitations;
  }

  if (!['semanticScholar', 'vectorSearch'].includes(searchMode)) {
    return { isValid: false, error: 'Search mode must be either "semanticScholar" or "vectorSearch"' };
  }

  return {
    isValid: true,
    data: {
      prompt: query.trim(), // Use query but return as prompt for consistency with the rest of your code
      page: parsedPage,
      limit: parsedLimit,
      searchMode,
      filters
    }
  };
}

// Main endpoint for source finding
router.post('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    // Debug logging
    console.log('[Source Finder] Request body:', JSON.stringify(req.body, null, 2));
    console.log('[Source Finder] Request headers:', JSON.stringify(req.headers, null, 2));

    // Validate input
    const validation = validateSearchInput(req.body);
    if (!validation.isValid) {
      console.log('[Source Finder] Validation failed:', validation.error);
      res.status(400).json({
        error: validation.error,
        receivedData: req.body,
        debug: {
          bodyKeys: Object.keys(req.body || {}),
          bodyType: typeof req.body,
          promptValue: req.body?.prompt,
          promptType: typeof req.body?.prompt
        }
      });
      return;
    }

    const { prompt, page, limit, searchMode, filters } = validation.data!;

    if (searchMode === 'semanticScholar') {
      const result = await callSemanticScholarAPI(prompt, page, limit, filters);
      const totalPages = Math.ceil(result.total / limit);

      res.json({
        papers: result.papers,
        total: result.total,
        page,
        limit,
        pages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      });
    } else if (searchMode === 'vectorSearch') {
      // For vectorSearch mode (not implemented yet)
      res.status(501).json({
        error: 'Vector search mode is not implemented yet',
        availableModes: ['semanticScholar']
      });
    } else {
      res.status(400).json({
        error: 'Invalid search mode',
        availableModes: ['semanticScholar']
      });
    }
  } catch (error: unknown) {
    console.error('[Source Finder] Error:', error);

    if (error instanceof Error) {
      res.status(500).json({
        error: 'Internal server error while searching for sources',
        message: error.message,
        stack: error.stack
      });
    } else {
      res.status(500).json({
        error: 'Unknown internal server error',
        message: 'Please try again later'
      });
    }
  }
});

// Health check endpoint
router.get('/health', (req: Request, res: Response): void => {
  res.json({
    status: 'ok',
    service: 'source-finder',
    timestamp: new Date().toISOString()
  });
});

export default router;