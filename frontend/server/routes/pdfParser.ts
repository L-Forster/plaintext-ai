/**
 * PDF Parser Router
 * 
 * Provides endpoints for parsing PDF files:
 * 1. Upload PDF files
 * 2. Extract text, metadata, and references
 * 3. Use OpenAI to structure extracted data
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { createRequire } from 'module';
import OpenAI from 'openai';
import { env } from '../env';

// Use require for CommonJS module
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'));
        }
    },
});

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
});

// Interfaces
interface ParsedPDFData {
    title: string;
    authors: string[];
    abstract: string;
    fullText: string;
    references: string[];
    metadata: {
        pageCount: number;
        wordCount: number;
        extractedAt: string;
    };
}

interface ExtractedMetadata {
    title: string;
    authors: string[];
    abstract: string;
    references: string[];
}

/**
 * Extract structured metadata from PDF text using OpenAI
 */
async function extractMetadataWithAI(text: string): Promise<ExtractedMetadata> {
    const truncatedText = text.substring(0, 15000); // Limit text for API call

    const prompt = `Analyze the following academic paper text and extract:
1. Title (the main title of the paper)
2. Authors (list of author names)
3. Abstract (the paper's abstract if present)
4. References (list of cited works with structured data)

Return as JSON in this exact format:
{
  "title": "Paper Title Here",
  "authors": ["Author 1", "Author 2"],
  "abstract": "Abstract text here...",
  "references": [
    {
      "title": "Title of the referenced paper",
      "authors": "Author names",
      "url": "URL if present or null",
      "doi": "DOI if present or null",
      "full": "Full reference text as it appears"
    }
  ]
}

For each reference, extract the paper title, authors, any URL, and DOI if present. The "full" field should contain the complete original reference text.
If any field cannot be determined, use empty string for title/abstract or empty array for authors/references.

PAPER TEXT:
${truncatedText}`;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-5-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_completion_tokens: 2000,
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(content);

        return {
            title: parsed.title || '',
            authors: Array.isArray(parsed.authors) ? parsed.authors : [],
            abstract: parsed.abstract || '',
            references: Array.isArray(parsed.references) ? parsed.references : [],
        };
    } catch (error) {
        console.error('[PDF Parser] Error extracting metadata with AI:', error);
        return {
            title: '',
            authors: [],
            abstract: '',
            references: [],
        };
    }
}

/**
 * POST /api/pdf/upload - Upload and parse a PDF file
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No PDF file uploaded' });
            return;
        }

        console.log(`[PDF Parser] Processing file: ${req.file.originalname} (${req.file.size} bytes)`);

        // Parse PDF
        const pdfData = await pdfParse(req.file.buffer);

        const fullText = pdfData.text || '';
        const wordCount = fullText.split(/\s+/).filter((w: string) => w.length > 0).length;

        console.log(`[PDF Parser] Extracted ${wordCount} words from ${pdfData.numpages} pages`);

        // Extract metadata using AI
        const metadata = await extractMetadataWithAI(fullText);

        const result: ParsedPDFData = {
            title: metadata.title || req.file.originalname.replace('.pdf', ''),
            authors: metadata.authors,
            abstract: metadata.abstract,
            fullText: fullText,
            references: metadata.references,
            metadata: {
                pageCount: pdfData.numpages || 0,
                wordCount,
                extractedAt: new Date().toISOString(),
            },
        };

        console.log(`[PDF Parser] Successfully parsed: "${result.title}" with ${result.references.length} references`);

        res.json({
            success: true,
            data: result,
        });
    } catch (error: any) {
        console.error('[PDF Parser] Error:', error);
        res.status(500).json({
            error: 'Failed to parse PDF',
            message: error.message,
        });
    }
});

/**
 * POST /api/pdf/extract-claims - Extract claims from uploaded PDF text
 */
router.post('/extract-claims', async (req: Request, res: Response): Promise<void> => {
    try {
        const { text } = req.body;

        if (!text || typeof text !== 'string') {
            res.status(400).json({ error: 'Text is required' });
            return;
        }

        const truncatedText = text.substring(0, 10000);

        const prompt = `Extract the main factual claims from this academic paper text.
For each claim, provide the claim text.
Format each claim on a separate line starting with "CLAIM: "

TEXT:
${truncatedText}`;

        const response = await openai.chat.completions.create({
            model: 'gpt-5-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_completion_tokens: 2000,
        });

        const content = response.choices[0]?.message?.content || '';
        const claims = content
            .split('\n')
            .filter(line => line.trim().startsWith('CLAIM:'))
            .map((line, index) => ({
                id: `claim-${index + 1}`,
                text: line.replace('CLAIM:', '').trim(),
            }));

        res.json({
            success: true,
            claims,
        });
    } catch (error: any) {
        console.error('[PDF Parser] Error extracting claims:', error);
        res.status(500).json({
            error: 'Failed to extract claims',
            message: error.message,
        });
    }
});

// Health check
router.get('/health', (req: Request, res: Response): void => {
    res.json({
        status: 'ok',
        service: 'pdf-parser',
        timestamp: new Date().toISOString(),
    });
});

export default router;
