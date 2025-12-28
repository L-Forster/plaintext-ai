/**
 * Claim Extractor Router
 *
 * Provides endpoints for extracting claims from text:
 * 1. Analyzes text using OpenAI's API
 * 2. Identifies and extracts factual claims
 * 3. Returns structured claim data
 */
import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { env } from '../env';
import { getModelIdForTask, selectModelForTask } from '../utils/modelSelection';

const router = Router();

// Ensure OpenAI API key is set
if (!env.OPENAI_API_KEY) {
  console.error('CRITICAL: OPENAI_API_KEY is not set. Claim Extractor will not function.');
}

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

interface Claim {
  id: string;
  text: string;
}

// Input validation function
function validateClaimExtractionInput(body: any): {
  isValid: boolean;
  error?: string;
  data?: {
    text: string;
  }
} {
  // Accept both 'text' and 'prompt' for flexibility
  const { text, prompt } = body;
  const inputText = text || prompt;

  if (!inputText || typeof inputText !== 'string' || inputText.trim().length === 0) {
    return { isValid: false, error: 'Text input is required and must be a non-empty string' };
  }

  if (inputText.trim().length > 10000) {
    return { isValid: false, error: 'Text input is too long (max 10,000 characters)' };
  }

  return {
    isValid: true,
    data: {
      text: inputText.trim()
    }
  };
}

/**
 * Extract claims from provided text using OpenAI
 */
async function extractClaims(text: string, openAIModelId: string): Promise<Claim[]> {
  const claimExtractionPrompt = `
You are an AI designed to extract factual claims from text. Analyze the following text
and extract all meaningful, substantive factual claims. These should be statements that
make factual assertions about the world that could be verified or disputed.

For each claim, provide ONLY the claim text without any additional explanation.
Format each claim on a separate line starting with "CLAIM: ".

TEXT TO ANALYZE:
${text}
`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await openai.chat.completions.create({
      model: openAIModelId,
      messages: [{ role: 'user', content: claimExtractionPrompt }],
      temperature: 0.1, // Low temperature for consistent extraction
      max_completion_tokens: 2000,
    });

    clearTimeout(timeoutId);

    const content = response.choices[0]?.message?.content || "";
    const claimLines = content.split('\n').filter(line => line.trim().startsWith('CLAIM:'));

    if (claimLines.length === 0) {
      console.warn('[Claim Extractor] No claims found in OpenAI response');
      return [];
    }

    return claimLines.map((line, index) => ({
      id: `claim-${index + 1}`,
      text: line.replace('CLAIM:', '').trim()
    })).filter(claim => claim.text.length > 0); // Filter out empty claims

  } catch (error) {
    console.error('[Claim Extractor] Error extracting claims:', error);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - OpenAI API took too long to respond');
      }
      throw error;
    }

    throw new Error('Unknown error occurred while extracting claims');
  }
}

/**
 * Simple claim extraction without using AI for fallback
 */
function extractClaimsSimple(text: string): Claim[] {
  // Split by periods, exclamation marks, and question marks to get sentences
  const sentences = text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 10); // Filter very short sentences

  return sentences.map((sentence, index) => ({
    id: `claim-${index + 1}`,
    text: sentence.trim()
  }));
}

// Main endpoint for claim extraction
router.post('/extract', async (req: Request, res: Response): Promise<void> => {
  try {
    // Debug logging
    console.log('[Claim Extractor] Request body:', JSON.stringify(req.body, null, 2));

    // Validate input
    const validation = validateClaimExtractionInput(req.body);
    if (!validation.isValid) {
      console.log('[Claim Extractor] Validation failed:', validation.error);
      res.status(400).json({
        error: validation.error,
        receivedData: req.body,
        debug: {
          bodyKeys: Object.keys(req.body || {}),
          bodyType: typeof req.body,
          textValue: req.body?.text || req.body?.prompt,
          textType: typeof (req.body?.text || req.body?.prompt)
        }
      });
      return;
    }

    const { text } = validation.data!;

    // Auto-select model based on task type (claim extraction is lightweight)
    const modelId = selectModelForTask('claim-extraction');
    const openAIModelId = getModelIdForTask('claim-extraction');

    let claims: Claim[] = [];
    let extractionMethod = 'ai';

    try {
      // Try to use OpenAI for extraction
      if (env.OPENAI_API_KEY) {
        claims = await extractClaims(text, openAIModelId); // Pass the OpenAI model ID
        console.log(`[Claim Extractor] Successfully extracted ${claims.length} claims using AI`);
      } else {
        throw new Error('OpenAI API key not configured');
      }
    } catch (error) {
      console.warn('[Claim Extractor] AI extraction failed, falling back to simple extraction:', error);
      // Fallback to simple extraction if AI fails
      claims = extractClaimsSimple(text);
      extractionMethod = 'simple';
      console.log(`[Claim Extractor] Successfully extracted ${claims.length} claims using simple method`);
    }

    res.json({
      claims,
      metadata: {
        extractionMethod,
        totalClaims: claims.length,
        modelId: modelId, // Report the model alias used
        timestamp: new Date().toISOString()
      }
    });
    return; // Ensure handler returns void

  } catch (error: unknown) {
    console.error('[Claim Extractor] Error:', error);

    if (error instanceof Error) {
      res.status(500).json({
        error: 'Internal server error while extracting claims',
        message: error.message,
        stack: error.stack
      });
      return; // Ensure handler returns void in this catch block
    } else {
      res.status(500).json({
        error: 'Unknown internal server error',
        message: 'Please try again later'
      });
      return; // Ensure handler returns void in this catch block
    }
  }
  // Adding a final return here just in case, though theoretically covered
  return;
});

// Health check endpoint
router.get('/health', (req: Request, res: Response): void => {
  res.json({
    status: 'ok',
    service: 'claim-extractor',
    hasOpenAIKey: !!env.OPENAI_API_KEY,
    timestamp: new Date().toISOString()
  });
  return; // Explicit return, though res.json() makes it effectively void for Express
});

export default router;