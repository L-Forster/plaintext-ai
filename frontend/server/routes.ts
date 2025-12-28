import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import aiAssistantRouter from './routes/aiAssistantRoutes';
import pdfParserRouter from './routes/pdfParser';
import citationNetworkRouter from './routes/citationNetwork';
import { handleWordExport } from './services/exportService';

export async function registerRoutes(app: Express): Promise<Server> {
  // Body parsers for JSON requests
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Trust proxy for self-hosted deployment
  app.set('trust proxy', 1);

  // Semantic Scholar API endpoint (public)
  app.get("/semantic-scholar/search", async (req, res, next) => {
    try {
      const query = req.query.q as string;
      if (!query || query.trim().length === 0) {
        res.status(400).json({ message: "Query parameter 'q' is required" });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const page = parseInt(req.query.page as string) || 1;

      // Call Semantic Scholar API
      const apiUrl = `https://api.semanticscholar.org/graph/v1/paper/search`;
      const searchParams = new URLSearchParams({
        query,
        limit: limit.toString(),
        offset: ((page - 1) * limit).toString(),
        fields: 'title,abstract,authors,year,citationCount,externalIds,fieldsOfStudy,embedding,journal,url'
      });

      const response = await fetch(`${apiUrl}?${searchParams}`, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`Semantic Scholar API error: ${response.status} ${response.statusText}`);
        res.status(response.status).json({
          message: `Error from Semantic Scholar API: ${response.statusText}`
        });
        return;
      }

      const data = await response.json();

      // Transform response to match our Paper interface
      const papers = data.data.map((paper: any) => ({
        arxiv_id: paper.externalIds?.ArXiv || paper.paperId,
        title: paper.title,
        summary: paper.abstract || '',
        authors: paper.authors?.map((author: any) => author.name) || [],
        journal: paper.journal?.name,
        citations: paper.citationCount,
        doi: paper.externalIds?.DOI,
        url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
        fieldOfStudy: paper.fieldsOfStudy,
        published: paper.year?.toString(),
        embedding: paper.embedding
      }));

      res.json({
        papers,
        page,
        limit,
        total: data.total || papers.length,
        pages: data.total ? Math.ceil(data.total / limit) : 1
      });
    } catch (error) {
      console.error("Semantic Scholar search error:", error);
      next(error);
    }
  });

  // Add the AI assistant router (all AI-powered research tools)
  app.use('/api', aiAssistantRouter);

  // PDF Parser routes
  app.use('/api/pdf', pdfParserRouter);

  // Citation Network routes
  app.use('/api/citations', citationNetworkRouter);

  // Export routes
  app.post('/api/export-tools/doc', handleWordExport);

  const server = createServer(app);
  return server;
}
