import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fetch from 'node-fetch';
import OpenAI from 'openai';
import { env } from '../env'; // Server-side env
import { Paper } from '../../client/src/types/paper'; // Adjust path as needed for Paper type
import contradictionCheckerRouter from './contradictionChecker'; // Import the contradiction checker router
import dataAnalysisRouter from './dataAnalysis'; // Import the data analysis router
import sourceFinderRouter from './sourceFinder'; // Import the source finder router
import claimExtractorRouter from './claimExtractor'; // Import the claim extractor router
import referenceManagementRouter from './referenceManagement'; // Import the reference management router
import literatureReviewRouter from './literatureReview'; // Import the literature review router
import exportToolsRouter from './exportTools'; // Import the export tools router
import { AVAILABLE_MODELS, getModelIdForTask, selectModelForTask, isValidModelAlias, type AIModel, type ModelAlias } from '../utils/modelSelection';

// console.log('[aiAssistantRoutes.ts] File loaded and router being configured.'); // Log file load

const router = Router();

// Mount the contradiction checker router at /contradiction-check
// This means the /check endpoint in contradictionCheckerRouter will be accessible at /contradiction-check/check
// console.log('[aiAssistantRoutes.ts] Mounting contradiction checker router at /contradiction-check');
router.use('/contradiction-check', contradictionCheckerRouter);

// Mount the data analysis router at /data-analysis
// console.log('[aiAssistantRoutes.ts] Mounting data analysis router at /data-analysis');
router.use('/data-analysis', dataAnalysisRouter);

// Mount the source finder router at /source-finder
router.use('/source-finder', sourceFinderRouter);

// Mount the claim extractor router at /claim-extractor
router.use('/claim-extractor', claimExtractorRouter);

// Mount the reference management router at /reference-management
router.use('/reference-management', referenceManagementRouter);

// Mount the literature review router at /literature-review
router.use('/literature-review', literatureReviewRouter);

// Mount the export tools router at /export-tools
router.use('/export-tools', exportToolsRouter);

if (!env.OPENAI_API_KEY) {
  console.error('CRITICAL: OPENAI_API_KEY is not set. AI Assistant routes will not function.');
  // Optionally, you could prevent the routes from being set up, but Express will handle requests to them with errors if the handler fails.
}

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

// Models are now imported from the shared utility
const availableModels = AVAILABLE_MODELS;

// Simple in-memory chat history store
// Simple in-memory chat history store
const chatHistory = new Map<string, OpenAI.Chat.Completions.ChatCompletionMessageParam[]>();

// Basic interface for S2 paper structure (subset)
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

interface LLMSearchResponseServer {
  llmResponseText: string;
  papers: Paper[];
  totalPapers?: number;
  modelId?: string;
  sessionId: string;
  creditsRemaining: number;
  creditType: string;
}

// Helper to transform S2 paper to our Paper type (similar to client-side)
function transformS2PaperToPaper(s2Paper: S2Paper): Paper {
  return {
    arxiv_id: s2Paper.externalIds?.ArXiv || s2Paper.paperId || '',
    title: s2Paper.title || "",
    summary: s2Paper.abstract || "",
    authors: s2Paper.authors?.map(author => author.name) || [],
    published: s2Paper.publicationDate || (s2Paper.year ? s2Paper.year.toString() : ''),
    citations: s2Paper.citationCount,
    journal: s2Paper.venue || "",
    doi: s2Paper.externalIds?.DOI || "",
    url: s2Paper.url || (s2Paper.externalIds?.ArXiv ? `https://arxiv.org/abs/${s2Paper.externalIds.ArXiv}` : ''),
    fieldOfStudy: s2Paper.fieldsOfStudy || [],
  };
}

// Function to analyze source diversity
function analyzeSourceDiversity(papers: Paper[]): { isDiverse: boolean; diversityReason?: string } {
  // If no papers, no diversity issue
  if (!papers || papers.length <= 1) {
    return { isDiverse: false };
  }

  // Count different sources/journals
  const journals = new Set(papers.map(p => p.journal).filter(j => j));
  const fields = new Set(papers.flatMap(p => p.fieldOfStudy || []));

  // Check publication years span
  const years = papers.map(p => {
    const year = p.published ? parseInt(p.published.substring(0, 4)) : null;
    return year;
  }).filter(y => y !== null) as number[];

  let minYear = years.length > 0 ? Math.min(...years) : 0;
  let maxYear = years.length > 0 ? Math.max(...years) : 0;
  const yearSpan = maxYear - minYear;

  // Check author diversity
  const allAuthors = papers.flatMap(p => p.authors || []);
  const uniqueAuthors = new Set(allAuthors);

  // Analyze if papers are too diverse
  let isDiverse = false;
  let diversityReason = "";

  if (journals.size > 3 && papers.length >= 5) {
    isDiverse = true;
    diversityReason = "The results come from many different journals, suggesting the topic might be too broad.";
  } else if (fields.size > 4) {
    isDiverse = true;
    diversityReason = "The results span multiple different fields, suggesting the query might be too ambiguous.";
  } else if (yearSpan > 15 && papers.length >= 3) {
    isDiverse = true;
    diversityReason = `The results span a wide time range (${minYear} to ${maxYear}), suggesting the topic might need to be narrowed to a specific time period.`;
  }

  return { isDiverse, diversityReason };
}

// Function to call Semantic Scholar API (reusable)
async function callSemanticScholarAPI(keywords: string, limit: number, yearFrom?: number, yearTo?: number, sortBy?: string): Promise<{ papers: Paper[], totalPapers: number }> {
  const S2_API_BASE_URL = 'https://api.semanticscholar.org/graph/v1';
  const fieldsToRequest = [
    'paperId', 'externalIds', 'url', 'title', 'abstract',
    'venue', 'year', 'publicationDate', 'authors.name', 'citationCount', 'fieldsOfStudy'
  ].join(',');

  const queryParams = new URLSearchParams({
    query: keywords,
    limit: limit.toString(),
    fields: fieldsToRequest,
  });

  if (yearFrom && yearTo) queryParams.append('year', `${yearFrom}-${yearTo}`);
  else if (yearFrom) queryParams.append('year', `${yearFrom}-`);
  else if (yearTo) queryParams.append('year', `-${yearTo}`);

  if (sortBy) {
    queryParams.append('sort', sortBy); // e.g., 'citationCount:desc'
  }

  const s2Url = `${S2_API_BASE_URL}/paper/search?${queryParams.toString()}`;
  // console.log(`[S2 API Call] Querying: ${s2Url}`);

  const s2Headers: { [key: string]: string } = { 'Content-Type': 'application/json' };
  if (env.SERVER_SEMANTIC_SCHOLAR_API_KEY) {
    s2Headers['x-api-key'] = env.SERVER_SEMANTIC_SCHOLAR_API_KEY;
  }

  const s2Response = await fetch(s2Url, { headers: s2Headers });

  if (!s2Response.ok) {
    const errorBody = await s2Response.text();
    console.error(`[S2 API Call] Error (${s2Response.status}): ${errorBody}`);
    if (s2Response.status === 429) {
      console.warn(`[S2 API Call] Rate limited by Semantic Scholar. Returning empty results.`);
      return { papers: [], totalPapers: 0 };
    }
    throw new Error(`Semantic Scholar API request failed: ${s2Response.statusText}`);
  }

  const s2Data = await s2Response.json() as { total: number; data: S2Paper[] };
  const papers = s2Data.data ? s2Data.data.map(transformS2PaperToPaper) : [];
  return { papers, totalPapers: s2Data.total || 0 };
}

// Define the tool for OpenAI
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_semantic_scholar_papers',
      description: 'Searches the Semantic Scholar database for academic papers based on keywords, year range, and other criteria.',
      parameters: {
        type: 'object',
        properties: {
          keywords: {
            type: 'string',
            description: 'The main keywords or topic to search for (e.g., \'machine learning\', \'CRISPR gene editing\').',
          },
          limit: {
            type: 'integer',
            description: 'The maximum number of papers to return. Default is 5.',
          },
          yearFrom: {
            type: 'integer',
            description: 'The starting year of the publication range (inclusive). Example: 2015',
          },
          yearTo: {
            type: 'integer',
            description: 'The ending year of the publication range (inclusive). Example: 2022',
          },
          sortBy: {
            type: 'string',
            description: 'How to sort the papers. For most impactful or cited, use \'citationCount:desc\'. Other options might include \'relevance\' or \'publicationDate:desc\'.',
            enum: ['relevance', 'citationCount:desc', 'publicationDate:desc']
          },
        },
        required: ['keywords'],
      }
    }
  },
];

router.post('/scholar-ai-query', async (req: Request, res: Response, next: NextFunction) => {
  // Start timer for RAG latency
  const startTime = Date.now();
  // console.log(`[aiAssistantRoutes.ts] POST /scholar-ai-query route handler entered. Body:`, req.body);
  const { prompt, sessionId } = req.body;

  // Auto-select model based on task type (scholar-query requires reasoning)
  const modelId = selectModelForTask('scholar-query');

  // Generate a sessionId if none provided
  const chatSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ message: 'Prompt is required and must be a string.' });
    return;
  }

  // Get the selected model
  const selectedModel = availableModels.find(model => model.id === modelId);
  if (!selectedModel) {
    res.status(400).json({ message: `Invalid model ID: ${modelId}. Available models: ${availableModels.map(m => m.id).join(', ')}` });
    return;
  }

  if (!env.OPENAI_API_KEY) {
    res.status(500).json({ message: 'AI Assistant is not configured (missing API key).' });
    return;
  }

  // Get or initialize chat history
  if (!chatHistory.has(chatSessionId)) {
    chatHistory.set(chatSessionId, [
      {
        role: 'system',
        content: (
          'You are an AI assistant helping users find academic papers using Semantic Scholar.\n' +
          'Your **critical mission** is to ensure the final list of papers returned to the user EXACTLY matches the paper(s) you describe in your textual response.\n\n' +
          'When asked to find papers:\n' +
          '1. Always use the `search_semantic_scholar_papers` tool.\n\n' +
          '2. **For Identifying a SINGLE SEMINAL/FOUNDATIONAL Paper (e.g., \'the transformer paper\', \'paper that introduced X\'):**\n' +
          '    a. **Keyword Synthesis (Step 1a):** Analyze the user\'s query. If the topic is a well-known concept (like \'transformer\'), consider if adding related core terms (e.g., \'attention\') to the `keywords` for the initial search would yield better candidates. For example, for \'the transformer paper\', initial keywords could be \'transformer attention\'. Use your best judgment for keyword synthesis.\n' +
          '    b. **Candidate Search (Step 1b):** Perform an initial tool call using the synthesized/original keywords. Use `sortBy: \'citationCount:desc\'` and `limit: 3` (or up to 5 if the topic is very broad or keywords are uncertain).\n' +
          '    c. **Review & Identify (Step 2):** Examine the titles, authors, and years of the papers returned from Step 1b.\n' +
          '    d. **MANDATORY Focused Fetch (Step 3 - If Seminal Paper Identified):**\n' +
          '        i. If you confidently identify THE single seminal paper from the candidates (e.g., \'Attention Is All You Need\' for \'transformer\'), you MUST make a **second tool call**.\n' +
          '        ii. For this second call, use the **exact full title** of that identified paper as the `keywords` and set `limit: 1`. This is essential.\n' +
          '        iii. Your final textual response AND the `papers` data array MUST be based **solely** on this second, focused tool call. The `papers` array should contain only this single paper.\n' +
          '    e. **Summarize Candidates (If No Single Seminal Paper Identified):**\n' +
          '        i. If you cannot confidently identify one single seminal paper from the candidates (e.g., after reviewing the initial 3-5 results, it\'s still unclear), then your textual response and `papers` data will be based on the results of the *first* tool call (Step 1b). Clearly state that multiple relevant papers were found or that the seminal paper could not be uniquely identified from the top results.\n\n' +
          '3. **For Finding Multiple Impactful/Highly Cited Papers (or general topic):**\n' +
          '    a. Use `sortBy: \'citationCount:desc\'. Base `limit` on the user\'s request (e.g., \'top 5 papers\') or a reasonable default (3-5).\n\n' +
          '4. **For General Topic Queries or Recent Papers:**\n' +
          '    a. Use `sortBy: \'relevance\'` or `sortBy: \'publicationDate:desc\'. Adjust `limit` as needed.\n\n' +
          '5. **Diversity Check:**\n' +
          '    a. If a search returns papers from many different fields or across a very wide time span, ask the user for clarification, as their query might be too broad.\n\n' +
          '6. **General Tool Usage:**\n' +
          '    a. Be precise with titles, authors, and publication years.\n' +
          '    b. The `papers` data in the final output to the user MUST align with your textual description. If you describe one paper, the data should contain only that one paper. If you describe multiple, it should contain those multiple papers.' +
          '\n\n' +
          '7. **High-Level Key Insights Summary:** Before presenting the list of papers, synthesize 3–5 concise bullet points capturing the main trends, open questions, or breakthroughs across the papers.' +
          '\n\n' +
          '8. **Per-Paper "Why It Matters" Blurb:** For each paper, include a 1–2 sentence note prefaced with "Why it matters:" explaining its unique contribution or key takeaway for a student reader.' +
          '\n\n' +
          '9. **Conversational Context and Follow-up Requests:**\n' +
          '    a. Pay close attention to the entire conversation history. Previous searches and their parameters (keywords, date ranges, sort order, number of results) are crucial context.\n' +
          '    b. If the user makes a follow-up request (e.g., "find 5 more", "try with different keywords", "what about papers from last year?", "sort these by date"), you MUST interpret this in the context of the *most recent* relevant paper search in the conversation.\n' +
          '    c. **Modifying Previous Search Parameters:**\n' +
          '        i. When a user asks for "more papers" (e.g., "5 more"), you should generally re-use the keywords, date ranges, and sort order from the most recent search, but adjust the `limit` parameter. For example, if the last search had `limit: 5` and the user asks for "5 more", the new search should use `limit: 10` (the total desired). Be explicit about how you interpret "more" and whether you are fetching an *additional* set or a *new total* set. The `papers` array in the final response should reflect the papers corresponding to your textual description of the current turn.\n' +
          '        ii. If the user provides new criteria (e.g., "only from 2020", "add keyword X"), modify the parameters of the most recent search accordingly.\n' +
          '        iii. If the users request is ambiguous regarding which previous search to modify or how to modify it, ask for clarification before proceeding with a tool call.\n' +
          '    d. When performing a follow-up search, clearly state in your textual response how you have adapted the search based on their request and the previous context (e.g., "Okay, I\'ve searched for 5 more papers on the same topic X, using the same criteria but increasing the limit to 10..." ).\n' +
          '    e. **If no clear prior search context exists for a follow-up, treat it as a new search request based on the information available in the follow-up.** For example, if the user just says "5 more papers" at the beginning of a session, you should ask "5 more papers related to what topic?".\n' +
          '    f. Your goal is to provide the papers requested in the *current* turn. If a follow-up implies modifying a previous search to get a *new set* of papers (e.g. total 10 instead of 5), the `papers` array in the response should contain this new set.' +
          '\n\n' +
          '10. **Referencing Papers from Previous Turns (e.g., \"tell me more about paper 1\"):**\n' +
          '    a. When you have previously presented a list of papers, users might refer to them by number (e.g., \"paper 1\", \"the first paper\"), position (\"the last paper you showed me\"), or other contextual cues based on your output.\n' +
          '    b. It is CRUCIAL to use the conversation history (specifically, the `papers` array you last sent to the user, which is also available in the assistant message history) to accurately identify which paper the user is referring to.\n' +
          '    c. If the user asks for details about a specific paper (e.g., \"tell me more about paper 1\"), your response should focus on that paper. The `papers` array in the final JSON output for such a request should ideally contain ONLY that single, specifically referenced paper.\n' +
          '    d. If the reference is ambiguous (e.g., you listed 3 papers and the user says \"tell me about that one paper\"), ask for clarification before proceeding.\n' +
          '    e. When providing details, clearly state which paper you are discussing to confirm understanding (e.g., \"Certainly, here are more details about \'Attention Is All You Need\'...\").'
        )
      }
    ]);
  }

  try {
    // Get existing messages for this session
    let messages = chatHistory.get(chatSessionId) || [];

    // Reset history if there's a corrupted state that could cause tool_call errors
    const hasToolCallError = messages.some(msg =>
      msg.role === 'tool' &&
      (!messages.some(m =>
        m.role === 'assistant' &&
        m.tool_calls &&
        m.tool_calls.some(tc => tc.id === (msg as any).tool_call_id)
      ))
    );

    if (hasToolCallError) {
      // console.log(`[${selectedModel.name}] Detected inconsistent chat history. Resetting to avoid tool call errors.`);
      // Keep only the system message and start fresh
      const systemMessage = messages[0];
      messages = [systemMessage];
      chatHistory.set(chatSessionId, messages);
    }

    // Add the new user message
    messages.push({ role: 'user', content: prompt });

    // console.log(`[${selectedModel.name}] Sending initial prompt: "${prompt}"`);
    let openaiResponse = await openai.chat.completions.create({
      model: selectedModel.modelId,
      messages: messages,
      tools: tools,
      tool_choice: 'auto',
    });

    let message = openaiResponse.choices[0].message;
    let papersData: Paper[] = [];
    let totalPapersFound: number | undefined = undefined;

    // Loop to handle potential multiple tool calls
    while (message.tool_calls && message.tool_calls.length > 0) {
      messages.push(message); // Add AI's message with tool calls to history

      // Process each tool call and collect responses
      const toolResponses = await Promise.all(
        message.tool_calls.map(async (toolCall) => {
          if (toolCall.function.name === 'search_semantic_scholar_papers') {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              // console.log('[Tool Call] search_semantic_scholar_papers with args:', args);

              const { papers, totalPapers } = await callSemanticScholarAPI(
                args.keywords,
                args.limit || 5,
                args.yearFrom,
                args.yearTo,
                args.sortBy
              );

              papersData = papers; // Store papers from the latest tool call
              totalPapersFound = totalPapers;

              // Check for source diversity
              const { isDiverse, diversityReason } = analyzeSourceDiversity(papers);

              return {
                tool_call_id: toolCall.id,
                role: 'tool' as const,
                content: JSON.stringify(isDiverse ?
                  {
                    papers,
                    totalPapers,
                    diversity: {
                      isDiverse: true,
                      reason: diversityReason
                    }
                  } :
                  { papers, totalPapers }
                )
              };
            } catch (error: any) {
              console.error(`[Tool Call] Error processing tool call ${toolCall.id}:`, error);
              return {
                tool_call_id: toolCall.id,
                role: 'tool' as const,
                content: JSON.stringify({
                  error: `Failed to retrieve papers: ${error.message || 'Unknown error'}`,
                  papers: []
                })
              };
            }
          }

          return {
            tool_call_id: toolCall.id,
            role: 'tool' as const,
            content: JSON.stringify({
              error: 'Unsupported tool',
              papers: []
            })
          };
        })
      );

      // Add all tool responses to history
      for (const toolResponse of toolResponses) {
        messages.push(toolResponse);
      }

      // Continue LLM generation with tool responses
      openaiResponse = await openai.chat.completions.create({
        model: selectedModel.modelId,
        messages: messages,
        tools: tools,
        tool_choice: 'auto',
      });

      message = openaiResponse.choices[0].message;
    }

    // Add final AI message to history
    messages.push(message);
    chatHistory.set(chatSessionId, messages);
    // Track request duration (telemetry removed)
    const durationMs = Date.now() - startTime;
    console.log(`[AI Assistant] Request completed in ${durationMs}ms`);

    res.json({
      success: true, data: {
        llmResponseText: message.content || '',
        papers: papersData,
        totalPapers: totalPapersFound,
        modelId: selectedModel.id,
        sessionId: chatSessionId,
      }
    });
  } catch (error: any) {
    console.error(`[${selectedModel.name}] Error:`, error);
    res.status(500).json({
      success: false,
      message: `AI Assistant error: ${error.message || 'Unknown error'}`
    });
  }
});

// Add route to get available models
// This route is now redundant as the client will use /api/credits/models from creditsRoutes.ts
/*
ruter.get('/available-models', (req, res) => {
  const modelsInfo = availableModels.map(model => ({
    id: model.id,
    name: model.name,
    description: model.description
  }));
  
  res.json({ models: modelsInfo });
});
*/

// Simple test route
router.post('/test-no-auth', (req, res) => {
  res.json({ success: true, message: "Router test route reached successfully!" });
});

// Adding interfaces for contradiction checker
interface Claim {
  id: string;
  text: string;
  contradicted: boolean;
  contradictionScore: number;
  evidences: Evidence[];
}

interface Evidence {
  id: string;
  text: string;
  source: string;
  doi?: string;
  url?: string;
  contradictionScore: number;
  isContradicting: boolean;
}

interface ContradictionCheckResponse {
  claims: Claim[];
  summary: string;
}

// Add a route for contradiction checking in the main router to use our contradictionChecker router
router.post('/contradiction-check', (req: Request, res: Response, next: NextFunction) => {
  // console.log(`[aiAssistantRoutes.ts] POST /contradiction-check route handler entered - forwarding to contradictionChecker`);

  // Log the request details for debugging
  // console.log(`[aiAssistantRoutes.ts] Request body:`, req.body);
  // console.log(`[aiAssistantRoutes.ts] Request URL before: ${req.url}`);

  // The contradictionChecker router is mounted at '/contradiction-check', so the check endpoint is available at '/contradiction-check/check'
  // When we receive a request to '/contradiction-check', we need to forward it to '/contradiction-check/check'
  req.url = '/check';

  // console.log(`[aiAssistantRoutes.ts] Request URL after: ${req.url}`);
  next();
});

// Add a debug route to help diagnose routing issues
router.get('/debug-routes', (req: Request, res: Response) => {
  // console.log('[aiAssistantRoutes.ts] Debug routes endpoint called');
  res.json({
    message: 'AI Assistant routes debugging info',
    availableEndpoints: [
      {
        path: '/api/scholar-ai-query',
        method: 'POST',
        description: 'LLM-assisted paper search'
      },
      {
        path: '/api/contradiction-check/check',
        method: 'POST',
        description: 'Contradiction checker main endpoint'
      },
      {
        path: '/api/data-analysis/analyze',
        method: 'POST',
        description: 'Data analysis for CSV files'
      },
      {
        path: '/api/data-analysis/status',
        method: 'GET',
        description: 'Data analysis service status'
      },
      {
        path: '/api/test-no-auth',
        method: 'POST',
        description: 'Test route (no auth)'
      }
    ]
  });
});

/**
 * Source Finder endpoint: searches Semantic Scholar for papers based on keywords and filters.
 */
router.get('/search-papers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, limit, yearFrom, yearTo, sortBy } = req.query;
    const keywords = String(q || '');
    const lim = parseInt(String(limit || '5'), 10);
    const fromYear = yearFrom ? parseInt(String(yearFrom), 10) : undefined;
    const toYear = yearTo ? parseInt(String(yearTo), 10) : undefined;
    const sort = sortBy ? String(sortBy) : undefined;

    if (!keywords.trim()) {
      res.status(400).json({ papers: [], totalPapers: 0, message: 'Query parameter q is required.' });
    }
    const { papers, totalPapers } = await callSemanticScholarAPI(keywords, lim, fromYear, toYear, sort);
    res.json({ papers, totalPapers });
  } catch (error: any) {
    console.error('[Source Finder] Error in /search-papers:', error);
    res.status(500).json({ papers: [], totalPapers: 0, error: error.message });
  }
});

// Define ToolType on the server (mirroring client if not already shared)
type ServerToolType =
  | 'Source Finder'
  | 'Contradiction Checker'
  | 'Data Analysis'
  | 'Claim Extractor'
  | 'AI Literature Review'
  | 'Reference & Citation Management'
  | 'Export TXT'
  | 'Export Google Doc'
  | 'Export DOC';

interface ServerToolDefinition {
  name: ServerToolType;
  description: string;
  expectedConfig?: string[];
}

const serverWorkflowToolsForLLM: ServerToolDefinition[] = [
  { name: 'Source Finder', description: 'Finds academic papers and sources based on keywords, topics, or research questions. Can filter by year range and limit number of results.', expectedConfig: ['query', 'limit', 'yearFrom', 'yearTo', 'searchMode', 'minCitations', 'prompt'] },
  { name: 'AI Literature Review', description: 'Generates a literature review based on a topic or a set of provided papers. Can be configured for type, scope, depth, tone, and year range.', expectedConfig: ['reviewTopicScope', 'reviewType', 'reviewDepthLength', 'reviewTone', 'yearFrom', 'yearTo', 'modelId', 'customReviewText', 'reviewPrompt', 'prompt'] },
  { name: 'Reference & Citation Management', description: 'Manages and formats academic references and bibliographies in various styles (e.g., APA, MLA). Takes a list of references or can process connected papers.', expectedConfig: ['referencesInput', 'citationStyle', 'format', 'modelId'] },
  { name: 'Claim Extractor', description: 'Extracts claims from a given text using an AI model.', expectedConfig: ['prompt', 'textInput', 'modelId'] },
  { name: 'Contradiction Checker', description: 'Checks for contradictions between multiple sets of text or claims using an AI model.', expectedConfig: ['prompt', 'prompt2', 'textInput', 'modelId'] },
  { name: 'Data Analysis', description: 'Analyzes provided data (e.g., from a connected CSV or described in a prompt) and generates insights using an AI model.', expectedConfig: ['prompt', 'dataInput', 'modelId'] },
  { name: 'Export TXT', description: 'Exports data or results from a preceding tool to a plain text (.txt) file. Can specify a filename.', expectedConfig: ['exportFileName', 'dataInput'] },
  { name: 'Export Google Doc', description: 'Exports data or results to a Google Document. Can specify a document name.', expectedConfig: ['exportFileName', 'dataInput'] },
  { name: 'Export DOC', description: 'Exports data or results to a Microsoft Word (.doc) file. Can specify a filename.', expectedConfig: ['exportFileName', 'dataInput'] },
];

router.post('/generate-workflow-from-text', async (req: Request, res: Response) => {
  const { userInput, existingNodeCount = 0, sessionId } = req.body;

  // Auto-select model based on task type (workflow generation requires reasoning)
  const modelId = selectModelForTask('workflow-generation');

  const workflowSessionId = sessionId || `wf_gen_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  if (!userInput || typeof userInput !== 'string') {
    res.status(400).json({ message: 'User input is required and must be a string.' });
  }

  const selectedModel = availableModels.find(model => model.id === modelId);
  if (!selectedModel) {
    res.status(400).json({ message: `Invalid model ID: ${modelId}.` });
    return;
  }

  // Process special "do it again" or similar requests
  const doItAgainPhrases = ['do it again', 'repeat that', 'same workflow', 'create the same'];
  const isDoItAgainRequest = doItAgainPhrases.some(phrase =>
    userInput.toLowerCase().includes(phrase.toLowerCase())
  );

  // Get or initialize chat history for this workflow session
  let messagesForLLM = chatHistory.get(workflowSessionId) || [];

  if (isDoItAgainRequest && messagesForLLM.length >= 3) {
    // Find the last successful workflow generation
    let lastAssistantMessage = null;
    for (let i = messagesForLLM.length - 1; i >= 0; i--) {
      if (messagesForLLM[i].role === 'assistant') {
        lastAssistantMessage = messagesForLLM[i];
        break;
      }
    }

    if (lastAssistantMessage && lastAssistantMessage.content) {
      try {
        // If we have a previous successful workflow, reuse it
        const parsedContent = JSON.parse(typeof lastAssistantMessage.content === 'string' ? lastAssistantMessage.content : JSON.stringify(lastAssistantMessage.content));
        if (parsedContent.nodes && parsedContent.edges) {
          // Add the new user input to history
          messagesForLLM.push({ role: 'user', content: userInput });
          chatHistory.set(workflowSessionId, messagesForLLM);

          // Return the previous workflow
          res.status(200).json({
            nodes: parsedContent.nodes,
            edges: parsedContent.edges,
            sessionId: workflowSessionId,
            message: "Regenerated the previous workflow."
          });
        }
      } catch (e) {
        // If parsing fails, continue with normal generation
        console.log("Failed to parse previous assistant message:", e);
      }
    }
  }

  const toolListString = serverWorkflowToolsForLLM.map(tool => {
    let configHint = tool.expectedConfig ? ` Can be configured with: ${tool.expectedConfig.join(', ')}.` : '';
    return `- Name: \\\"${tool.name}\\\"\\\\n  Description: ${tool.description}${configHint}`;
  }).join('\\\\n');

  const systemPromptContent = `
You are an expert workflow generation assistant. Your task is to analyze the user's request and create a workflow using the provided tools.

Available Tools:
${toolListString}

APPROACH TO WORKFLOW GENERATION:

IMPORTANT: You MUST ALWAYS generate a workflow, even if the request is simple or vague. 
NEVER respond with an error or clarification unless it's impossible to generate any workflow.

CRITICALLY IMPORTANT - KEYWORD EXTRACTION:
- You MUST extract specific topics or keywords from the user's request
- For ANY request involving papers, research, or downloads, ALWAYS use these exact keywords in the Source Finder's "prompt" field
- Example: If user says "make a workflow that downloads papers on transformers", you MUST set config.prompt = "transformers"
- Example: If user says "find AI ethics papers", you MUST set config.prompt = "AI ethics"
- NEVER use generic placeholders like "research papers" or empty strings
- If the request has multiple topics, use them all (e.g., "machine learning and ethics" → prompt: "machine learning and ethics")

For simple requests like "find papers", "do research", "help me write", "find sources" or "find and export":
- Create a basic workflow starting with "Source Finder" and ending with an Export tool
- Use reasonable defaults for any missing details

For requests like "do it again" or "repeat that", regenerate the last workflow with the same tools.

If the user mentions specific topics (like "climate change" or "machine learning"), include those in the query/prompt config.

When creating a workflow, you MUST respond with a JSON object containing two arrays: "nodes" and "edges".

1. **Nodes Array**: Each object in the "nodes" array represents a tool in the workflow and must have the following structure:
    * \\\`id\\\`: A unique string identifier for the node (e.g., "ToolName_1", "ToolName_2"). Use an existingNodeCount (currently ${existingNodeCount}) to ensure uniqueness if adding to an existing flow, e.g. start IDs from ${existingNodeCount + 1}.
    * \\\`type\\\`: Must be "toolNode".
    * \\\`position\\\`: An object { x: number, y: number }. For the first node, use { x: 100, y: 100 }. For subsequent nodes, increment the y position by approximately 250-300 (e.g., { x: 100, y: 350 }, then { x: 100, y: 650 }, etc.) to ensure good visual separation between tools.
    * \\\`data\\\`: An object containing:
        * \\\`id\\\`: Same as the node's \\\`id\\\`.
        * \\\`label\\\`: A descriptive label, e.g., "LLM: Source Finder".
        * \\\`toolType\\\`: The exact name of the tool from the "Available Tools" list (e.g., "Source Finder").
        * \\\`config\\\`: An object {}. Attempt to infer configuration values (like 'query', 'prompt', 'limit', 'yearFrom', 'yearTo', 'exportFileName', 'citationStyle', 'reviewTopicScope') from the user's request. If a value is not specified or cannot be reasonably inferred, omit it or use an empty string. Prioritize 'prompt' for tools like Claim Extractor, AI Literature Review unless 'query' is more fitting (like for Source Finder).
        * \\\`status\\\`: Initialize to "pending".

2. **Edges Array**: If multiple tools are chosen, create objects in the "edges" array to connect them sequentially. Each edge object must have:
    * \\\`id\\\`: A unique string identifier for the edge (e.g., "edge_SourceFinder_1_to_AILiteratureReview_2").
    * \\\`source\\\`: The \\\`id\\\` of the source node.
    * \\\`target\\\`: The \\\`id\\\` of the target node.
    * \\\`markerEnd\\\`: An object { type: "ArrowClosed" }.
    * \\\`style\\\`: An object { stroke: "#888", strokeWidth: 2 }.

Guidelines:
- Ensure \\\`toolType\\\` in node.data EXACTLY matches one of the provided tool names.
- If the user mentions saving, exporting, or downloading, use one of the "Export" tools. If no format is specified, default to "Export TXT".

Example of a simple node (JSON formatted for the LLM to mimic):
{
  "id": "SourceFinder_1",
  "type": "toolNode",
  "position": { "x": 100, "y": 100 },
  "data": {
    "id": "SourceFinder_1",
    "label": "LLM: Source Finder",
    "toolType": "Source Finder",
    "config": { "prompt": "transformers", "limit": 10 },
    "status": "pending"
  }
}

Example of a simple edge (JSON formatted for the LLM to mimic):
{
  "id": "edge_SourceFinder_1_to_ExportTXT_2",
  "source": "SourceFinder_1",
  "target": "ExportTXT_2",
  "markerEnd": { "type": "ArrowClosed" },
  "style": { "stroke": "#888", "strokeWidth": 2 }
}

Respond ONLY with the JSON object. Do not include any explanatory text before or after the JSON.

DEFAULT WORKFLOWS FOR SIMPLE REQUESTS:
1. For "find papers" or "find sources": 
   Source Finder → Export TXT
   
2. For research workflows:
   Source Finder → AI Literature Review → Export TXT
   
3. For analysis workflows:
   Source Finder → Claim Extractor → Contradiction Checker → Export TXT
`;

  if (messagesForLLM.length === 0) {
    messagesForLLM.push({ role: 'system', content: systemPromptContent });
    chatHistory.set(workflowSessionId, messagesForLLM);
  } else {
    // Update the system message with the latest system prompt
    messagesForLLM[0] = { role: 'system', content: systemPromptContent };
  }

  // Add the current user input to messages
  messagesForLLM.push({ role: 'user', content: userInput });
  chatHistory.set(workflowSessionId, messagesForLLM);

  try {
    const llmResponse = await openai.chat.completions.create({
      model: selectedModel.modelId,
      messages: messagesForLLM, // Using the full conversation history including system prompt
      response_format: { type: "json_object" },
    });

    const responseContent = llmResponse.choices[0].message.content;
    if (!responseContent) {
      throw new Error('LLM returned empty content.');
    }

    // Store this interaction in history
    messagesForLLM.push({ role: 'assistant', content: responseContent });
    chatHistory.set(workflowSessionId, messagesForLLM);

    let parsedWorkflow = JSON.parse(responseContent);

    if (!parsedWorkflow || !Array.isArray(parsedWorkflow.nodes) || !Array.isArray(parsedWorkflow.edges)) {
      // If we don't have proper nodes/edges, generate a default workflow
      const defaultWorkflow = generateDefaultWorkflow(existingNodeCount);

      // Store the default workflow in chat history
      const lastIndex = messagesForLLM.length - 1;
      messagesForLLM[lastIndex] = {
        role: 'assistant',
        content: JSON.stringify(defaultWorkflow)
      } as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam;
      chatHistory.set(workflowSessionId, messagesForLLM);

      res.status(200).json({
        ...defaultWorkflow,
        sessionId: workflowSessionId,
        message: "Generated a default workflow based on your request."
      });
    }

    // Return sessionId along with the workflow data
    res.status(200).json({
      ...parsedWorkflow,
      sessionId: workflowSessionId
    });

  } catch (error: any) {
    console.error('[AI Assistant] Error generating workflow from text:', error);

    // If there's an error, generate a default workflow instead of failing
    const defaultWorkflow = generateDefaultWorkflow(existingNodeCount);

    res.status(200).json({
      ...defaultWorkflow,
      sessionId: workflowSessionId,
      message: "Generated a default workflow due to an error."
    });
  }
});

// Helper function to generate a default workflow
function generateDefaultWorkflow(existingNodeCount: number) {
  const sourceFinderNode = {
    id: `SourceFinder_${existingNodeCount + 1}`,
    type: "toolNode",
    position: { x: 100, y: 100 },
    data: {
      id: `SourceFinder_${existingNodeCount + 1}`,
      label: "Source Finder",
      toolType: "Source Finder",
      config: { prompt: "transformers", limit: 10 },
      status: "pending"
    }
  };

  const exportNode = {
    id: `ExportTXT_${existingNodeCount + 2}`,
    type: "toolNode",
    position: { x: 100, y: 350 },
    data: {
      id: `ExportTXT_${existingNodeCount + 2}`,
      label: "Export TXT",
      toolType: "Export TXT",
      config: { exportFileName: "transformer_papers.txt" },
      status: "pending"
    }
  };

  const edge = {
    id: `edge_${sourceFinderNode.id}_to_${exportNode.id}`,
    source: sourceFinderNode.id,
    target: exportNode.id,
    markerEnd: { type: "ArrowClosed" },
    style: { stroke: "#888", strokeWidth: 2 }
  };

  return {
    nodes: [sourceFinderNode, exportNode],
    edges: [edge]
  };
}

export default router;