/**
 * AI Literature Review Router
 * 
 * Provides endpoints for generating literature reviews:
 * 1. Takes academic papers as input
 * 2. Generates a comprehensive literature review using OpenAI
 * 3. Returns structured review data
 */

import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { env } from '../env';
import { Paper } from '../../client/src/types/paper';
import { getModelIdForTask, selectModelForTask } from '../utils/modelSelection';

const router = Router();

// Ensure OpenAI API key is set
if (!env.OPENAI_API_KEY) {
  console.error('CRITICAL: OPENAI_API_KEY is not set. Literature Review will not function.');
}

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

/**
 * Generate a literature review from papers and parameters
 */
async function generateLiteratureReview(
  topicScope: string,
  reviewType: string,
  reviewDepthLength: string,
  reviewTone: string,
  yearFrom: string | undefined,
  yearTo: string | undefined,
  papers: Paper[],
  openAIModelId: string
): Promise<string> {
  // Build a context from the provided papers
  let paperContext = '';
  if (papers && papers.length > 0) {
    paperContext = papers.map(paper => {
      return `Title: ${paper.title}
Authors: ${paper.authors?.join(', ') || 'Unknown'}
Year: ${paper.published || 'Unknown'}
Abstract: ${paper.summary || 'Not available'}
---`;
    }).join('\n\n');
  }

  // Build the review prompt
  const reviewPrompt = `
  You are an academic expert tasked with creating a ${reviewDepthLength} ${reviewType} literature review in a ${reviewTone} tone.
  
  TOPIC AND SCOPE:
  ${topicScope}
  
  ${yearFrom || yearTo ? `TIME PERIOD: ${yearFrom || ''} to ${yearTo || ''}` : ''}
  
  ${papers && papers.length > 0 ? `AVAILABLE PAPERS FOR REVIEW:
  ${paperContext}` : 'No specific papers were provided. Generate a literature review based on your knowledge of the field.'}
  
  Your literature review should:
  1. Provide an introduction to the topic
  2. Summarize key findings and trends
  3. Identify gaps in the literature
  4. Draw conclusions based on the available research
  5. Suggest directions for future research
  
  Please structure the review in a coherent, ${reviewDepthLength === 'comprehensive' ? 'detailed' : 'concise'} manner.
  `;

  try {
    const response = await openai.chat.completions.create({
      model: openAIModelId,
      messages: [{ role: 'user', content: reviewPrompt }],
      max_completion_tokens: reviewDepthLength === 'comprehensive' ? 2000 :
        reviewDepthLength === 'standard' ? 1200 : 800,
      temperature: 0.7,
    });

    return response.choices[0].message.content || "Unable to generate review.";
  } catch (error) {
    console.error('[Literature Review] Error generating review:', error);
    throw error;
  }
}

// Main endpoint for literature review generation
router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      reviewTopicScope,
      reviewType = 'narrative',
      reviewDepthLength = 'standard',
      reviewTone = 'academic',
      yearFrom,
      yearTo,
      papers = []
    } = req.body;

    // Auto-select model based on task type (literature review requires reasoning and synthesis)
    const modelId = selectModelForTask('literature-review');
    const openAIModelId = getModelIdForTask('literature-review');

    if (!reviewTopicScope || typeof reviewTopicScope !== 'string' || reviewTopicScope.trim().length === 0) {
      res.status(400).json({ error: 'Topic and scope are required' });
      return;
    }

    // Generate the literature review
    const reviewText = await generateLiteratureReview(
      reviewTopicScope,
      reviewType,
      reviewDepthLength,
      reviewTone,
      yearFrom,
      yearTo,
      papers,
      openAIModelId
    );

    res.json({
      review: reviewText,
      papers: papers,
      // Include metadata about the review
      metadata: {
        type: reviewType,
        depth: reviewDepthLength,
        tone: reviewTone,
        yearRange: yearFrom || yearTo ? `${yearFrom || ''} - ${yearTo || ''}` : 'Not specified',
        modelId: modelId
      }
    });
    return;
  } catch (error: any) {
    console.error('[Literature Review] Error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
    return;
  }
});

export default router; 