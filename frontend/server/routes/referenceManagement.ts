/**
 * Reference & Citation Management Router
 * 
 * Provides endpoints for managing academic references:
 * 1. Formats references in different citation styles
 * 2. Extracts bibliographic data from text
 * 3. Returns formatted citations
 */

import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { env } from '../env';
import { getModelIdForTask, selectModelForTask } from '../utils/modelSelection';

const router = Router();

// Ensure OpenAI API key is set
if (!env.OPENAI_API_KEY) {
  console.error('CRITICAL: OPENAI_API_KEY is not set. Reference Management will not function.');
}

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

interface Reference {
  id: string;
  originalText: string;
  formattedText: string;
}

/**
 * Format references using OpenAI
 */
async function formatReferences(
  references: string[],
  citationStyle: string,
  openAIModelId: string
): Promise<Reference[]> {
  // Skip empty or too short references
  const validReferences = references.filter(ref => ref.trim().length > 5);
  if (validReferences.length === 0) {
    return [];
  }
  
  const styleGuide = getCitationStyleGuide(citationStyle);
  
  const formattingPrompt = `
  You are an expert in academic citations. Format the following references in ${citationStyle} style.
  
  ${styleGuide}
  
  REFERENCES TO FORMAT:
  ${validReferences.join('\n\n')}
  
  For each reference, provide only the formatted citation with no additional text or explanation.
  Format each reference on a separate line starting with "FORMATTED: ".
  `;
  
  try {
    const response = await openai.chat.completions.create({
      model: openAIModelId,
      messages: [{ role: 'user', content: formattingPrompt }],
    });
    
    const content = response.choices[0].message.content || "";
    const formattedLines = content.split('\n').filter(line => line.trim().startsWith('FORMATTED:'));
    
    if (formattedLines.length === 0) {
      // If no FORMATTED: lines, assume the entire output is formatted references
      return validReferences.map((ref, index) => ({
        id: `ref-${index + 1}`,
        originalText: ref.trim(),
        formattedText: content.split('\n')[index]?.trim() || ref.trim()
      }));
    }
    
    // Map the formatted lines back to the original references
    const result: Reference[] = [];
    for (let i = 0; i < Math.min(validReferences.length, formattedLines.length); i++) {
      result.push({
        id: `ref-${i + 1}`,
        originalText: validReferences[i].trim(),
        formattedText: formattedLines[i].replace('FORMATTED:', '').trim()
      });
    }
    
    // Handle any remaining references if there were more inputs than outputs
    for (let i = formattedLines.length; i < validReferences.length; i++) {
      result.push({
        id: `ref-${i + 1}`,
        originalText: validReferences[i].trim(),
        formattedText: `[${citationStyle}] ${validReferences[i].trim()}`
      });
    }
    
    return result;
  } catch (error) {
    console.error('[Reference Manager] Error formatting references:', error);
    throw error;
  }
}

/**
 * Get citation style guide for common styles
 */
function getCitationStyleGuide(style: string): string {
  switch (style.toLowerCase()) {
    case 'apa':
      return `
      APA Style Guidelines:
      - Author last name, First initial. (Year). Title. Publisher.
      - For journal articles: Author, A. A., & Author, B. B. (Year). Title of article. Title of Journal, volume(issue), page range. DOI
      `;
    case 'mla':
      return `
      MLA Style Guidelines:
      - Author Last Name, First Name. "Title of Article." Title of Journal, vol. number, issue number, Year, pp. pages.
      - For books: Author Last Name, First Name. Title of Book. Publisher, Year.
      `;
    case 'chicago':
      return `
      Chicago Style Guidelines:
      - Last name, First name. Title of Book. Place of publication: Publisher, Year.
      - For journal articles: Last name, First name. "Title of Article." Title of Journal volume, no. issue (Year): page range.
      `;
    case 'harvard':
      return `
      Harvard Style Guidelines:
      - Author Last Name, Initial(s). (Year) Title of book. Place of Publication: Publisher.
      - For journal articles: Author Last Name, Initial(s). (Year) 'Title of article', Title of Journal, Volume(Issue), page range.
      `;
    case 'vancouver':
      return `
      Vancouver Style Guidelines:
      - Author A, Author B. Title. Place of publication: Publisher; Year.
      - For journal articles: Author A, Author B. Article title. Journal Title. Year;Volume(Issue):Pages.
      `;
    case 'ieee':
      return `
      IEEE Style Guidelines:
      - [1] A. Author, B. Author, "Title of article," Title of Journal, vol. x, no. x, pp. xxx-xxx, Month Year.
      - For books: [1] A. Author, Title of Book. Place of publication: Publisher, year.
      `;
    default:
      return `Format the references in ${style} style, following standard academic conventions.`;
  }
}

// Main endpoint for reference formatting
router.post('/format', async (req: Request, res: Response) => {
  try {
    const { referencesInput, citationStyle = 'APA' } = req.body;

    // Auto-select model based on task type (reference formatting is lightweight)
    const modelId = selectModelForTask('reference-formatting');
    const openAIModelId = getModelIdForTask('reference-formatting');

    if (!referencesInput || typeof referencesInput !== 'string' || referencesInput.trim().length === 0) {
      res.status(400).json({ error: 'References input is required' });
      return;
    }

    if (!citationStyle || typeof citationStyle !== 'string') {
      res.status(400).json({ error: 'Citation style is required' });
      return;
    }

    // Split references by new line
    const references = referencesInput.split('\n').filter(ref => ref.trim().length > 0);

    if (references.length === 0) {
      res.status(400).json({ error: 'No valid references found in input' });
      return;
    }

    // Format the references
    const formattedRefs = await formatReferences(references, citationStyle, openAIModelId);
    
    // Combine into a single formatted string for response
    const formattedReferences = formattedRefs.map(ref => ref.formattedText).join('\n\n');
    
    res.json({
      formattedReferences,
      references: formattedRefs,
      metadata: {
        style: citationStyle,
        count: formattedRefs.length,
        modelId: modelId
      }
    });
  } catch (error: any) {
    console.error('[Reference Manager] Error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router; 