/**
 * Citation Network Router
 * 
 * Provides endpoints for building citation networks:
 * 1. Fetch papers that cite a given paper
 * 2. Fetch papers that a given paper references
 * 3. Build full citation graph with configurable depth
 */

import { Router, Request, Response } from 'express';
import { env } from '../env';
import { Paper } from '../../client/src/types/paper';
import { GraphData, GraphNode, GraphLink } from '../../client/src/lib/api';

const router = Router();

// Semantic Scholar API base URL
const S2_API_BASE = 'https://api.semanticscholar.org/graph/v1';

// Fields to request from S2 API
const PAPER_FIELDS = 'paperId,externalIds,url,title,abstract,venue,year,authors,citationCount,fieldsOfStudy';

/**
 * Transform S2 paper to our Paper type
 */
function transformToPaper(s2Paper: any): Paper {
    return {
        arxiv_id: s2Paper.externalIds?.ArXiv || s2Paper.paperId || '',
        title: s2Paper.title || '',
        summary: s2Paper.abstract || '',
        authors: s2Paper.authors?.map((a: any) => a.name) || [],
        published: s2Paper.year?.toString() || '',
        citations: s2Paper.citationCount || 0,
        journal: s2Paper.venue || '',
        doi: s2Paper.externalIds?.DOI || '',
        url: s2Paper.url || '',
        fieldOfStudy: s2Paper.fieldsOfStudy || [],
    };
}

/**
 * Fetch citations for a paper (papers that cite this paper)
 */
async function fetchCitations(paperId: string, limit: number = 10): Promise<Paper[]> {
    const url = `${S2_API_BASE}/paper/${paperId}/citations?fields=${PAPER_FIELDS}&limit=${limit}`;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (env.SERVER_SEMANTIC_SCHOLAR_API_KEY) {
        headers['x-api-key'] = env.SERVER_SEMANTIC_SCHOLAR_API_KEY;
    }

    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Citation Network] Citations API error: ${response.status} - ${errorText}`);
            throw new Error(`Semantic Scholar API error (${response.status}): ${errorText || response.statusText}`);
        }

        const data = await response.json();
        return (data.data || [])
            .filter((item: any) => item.citingPaper)
            .map((item: any) => transformToPaper(item.citingPaper));
    } catch (error: any) {
        console.error('[Citation Network] Error fetching citations:', error);
        throw error;
    }
}

/**
 * Fetch references for a paper (papers this paper cites)
 */
async function fetchReferences(paperId: string, limit: number = 10): Promise<Paper[]> {
    const url = `${S2_API_BASE}/paper/${paperId}/references?fields=${PAPER_FIELDS}&limit=${limit}`;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (env.SERVER_SEMANTIC_SCHOLAR_API_KEY) {
        headers['x-api-key'] = env.SERVER_SEMANTIC_SCHOLAR_API_KEY;
    }

    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Citation Network] References API error: ${response.status} - ${errorText}`);
            throw new Error(`Semantic Scholar API error (${response.status}): ${errorText || response.statusText}`);
        }

        const data = await response.json();
        return (data.data || [])
            .filter((item: any) => item.citedPaper)
            .map((item: any) => transformToPaper(item.citedPaper));
    } catch (error: any) {
        console.error('[Citation Network] Error fetching references:', error);
        throw error;
    }
}

/**
 * Build a citation network graph
 */
async function buildCitationNetwork(
    paperId: string,
    depth: number = 1,
    maxNodes: number = 50
): Promise<GraphData> {
    const nodes: Map<string, GraphNode> = new Map();
    const links: GraphLink[] = [];
    const visited: Set<string> = new Set();
    const queue: { id: string; currentDepth: number }[] = [{ id: paperId, currentDepth: 0 }];

    while (queue.length > 0 && nodes.size < maxNodes) {
        const { id, currentDepth } = queue.shift()!;

        if (visited.has(id) || currentDepth > depth) continue;
        visited.add(id);

        // Fetch the paper details if not already in nodes
        if (!nodes.has(id)) {
            const url = `${S2_API_BASE}/paper/${id}?fields=${PAPER_FIELDS}`;
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (env.SERVER_SEMANTIC_SCHOLAR_API_KEY) {
                headers['x-api-key'] = env.SERVER_SEMANTIC_SCHOLAR_API_KEY;
            }

            try {
                const response = await fetch(url, { headers });
                if (response.ok) {
                    const paperData = await response.json();
                    const paper = transformToPaper(paperData);
                    nodes.set(id, {
                        id,
                        label: paper.title || id,
                        paper,
                    });
                } else {
                    const errorText = await response.text();
                    console.error(`[Citation Network] API error for paper ${id}: ${response.status} - ${errorText}`);
                    if (currentDepth === 0) {
                        throw new Error(`Paper not found (${response.status}): ${errorText || response.statusText}`);
                    }
                }
            } catch (error) {
                console.error(`[Citation Network] Error fetching paper ${id}:`, error);
                if (currentDepth === 0) throw error;
            }
        }

        if (currentDepth < depth && nodes.size < maxNodes) {
            // Fetch citations and references
            const [citations, references] = await Promise.all([
                fetchCitations(id, 5),
                fetchReferences(id, 5),
            ]);

            // Add citing papers
            for (const paper of citations) {
                const citingId = paper.arxiv_id;
                if (citingId && !nodes.has(citingId) && nodes.size < maxNodes) {
                    nodes.set(citingId, {
                        id: citingId,
                        label: paper.title || citingId,
                        paper,
                    });
                    links.push({
                        source: citingId,
                        target: id,
                        label: 'cites',
                    });
                    queue.push({ id: citingId, currentDepth: currentDepth + 1 });
                }
            }

            // Add referenced papers
            for (const paper of references) {
                const refId = paper.arxiv_id;
                if (refId && !nodes.has(refId) && nodes.size < maxNodes) {
                    nodes.set(refId, {
                        id: refId,
                        label: paper.title || refId,
                        paper,
                    });
                    links.push({
                        source: id,
                        target: refId,
                        label: 'references',
                    });
                    queue.push({ id: refId, currentDepth: currentDepth + 1 });
                }
            }
        }
    }

    return {
        nodes: Array.from(nodes.values()),
        links,
    };
}

/**
 * GET /api/citations/:paperId/network - Build full citation network
 */
router.get('/:paperId/network', async (req: Request, res: Response): Promise<void> => {
    try {
        const { paperId } = req.params;
        const depth = parseInt(req.query.depth as string) || 1;
        const maxNodes = parseInt(req.query.maxNodes as string) || 50;

        console.log(`[Citation Network] Building network for ${paperId}, depth=${depth}, maxNodes=${maxNodes}`);

        const graphData = await buildCitationNetwork(paperId, depth, maxNodes);

        console.log(`[Citation Network] Built graph with ${graphData.nodes.length} nodes and ${graphData.links.length} links`);

        res.json({
            success: true,
            data: graphData,
        });
    } catch (error: any) {
        console.error('[Citation Network] Error:', error);
        const status = error.message.includes('(404)') ? 404 : 500;
        res.status(status).json({
            success: false,
            error: 'Failed to build citation network',
            message: error.message,
        });
    }
});

/**
 * GET /api/citations/:paperId/citations - Get papers that cite this paper
 */
router.get('/:paperId/citations', async (req: Request, res: Response): Promise<void> => {
    try {
        const { paperId } = req.params;
        const limit = parseInt(req.query.limit as string) || 10;

        const citations = await fetchCitations(paperId, limit);

        res.json({
            success: true,
            data: citations,
            count: citations.length,
        });
    } catch (error: any) {
        console.error('[Citation Network] Error fetching citations:', error);
        res.status(500).json({
            error: 'Failed to fetch citations',
            message: error.message,
        });
    }
});

/**
 * GET /api/citations/:paperId/references - Get papers this paper cites
 */
router.get('/:paperId/references', async (req: Request, res: Response): Promise<void> => {
    try {
        const { paperId } = req.params;
        const limit = parseInt(req.query.limit as string) || 10;

        const references = await fetchReferences(paperId, limit);

        res.json({
            success: true,
            data: references,
            count: references.length,
        });
    } catch (error: any) {
        console.error('[Citation Network] Error fetching references:', error);
        res.status(500).json({
            error: 'Failed to fetch references',
            message: error.message,
        });
    }
});

// Health check
router.get('/health', (req: Request, res: Response): void => {
    res.json({
        status: 'ok',
        service: 'citation-network',
        timestamp: new Date().toISOString(),
    });
});

export default router;
