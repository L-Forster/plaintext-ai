import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MainLayout } from '@/components/ui/layout/MainLayout';
import { Input } from "@/components/ui/input";
import {
  Search as SearchIcon,
  SendHorizontal as SendIcon,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Sparkles,
  Menu,
  Brain,
  Square,
  CloudLightning,
  LucideCloudLightning,
  X,
  FileText,
  Network
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Paper } from '@/types/paper';
import {
  getLLMAssistedSearchResult,
  testDirectRoute,
  testRouter,
  testDirectAiLikeRoute,
  LLMSearchResponse,
  checkContradictions,
  analyzeCSVFile,
  DataAnalysisResult,
  DataInsight
} from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { PaperDetails } from '@/components/PaperDetails';
import GraphVisualization from '@/components/GraphVisualization';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useLocation, useParams } from 'wouter';
import { useToast } from "@/components/ui/use-toast";
import { apiRequest } from '@/lib/queryClient';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface AIModel {
  id: string;
  name: string;
  description: string;
  icon?: React.ReactNode;
}

interface ChatExchange {
  prompt: string;
  llmResponse: LLMSearchResponse | null;
  error: Error | null;
  isPending: boolean;
  modelIdForQuery: string;
}

type ResearchMode =
  | 'paper-search'
  | 'gap-analysis'
  | 'contradiction-checker'
  | 'data-analysis'
  | 'suggested-reading'
  | 'pdf-upload'
  | 'citation-network';

// URL slug to ResearchMode mapping
const modeSlugMap: Record<string, ResearchMode> = {
  '': 'paper-search',
  'search': 'paper-search',
  'pdf': 'pdf-upload',
  'citations': 'citation-network',
  'contradictions': 'contradiction-checker',
  'data': 'data-analysis',
  'gaps': 'gap-analysis',
  'reading': 'suggested-reading',
};

// ResearchMode to URL slug mapping
const modeToSlugMap: Record<ResearchMode, string> = {
  'paper-search': 'search',
  'pdf-upload': 'pdf',
  'citation-network': 'citations',
  'contradiction-checker': 'contradictions',
  'data-analysis': 'data',
  'gap-analysis': 'gaps',
  'suggested-reading': 'reading',
};

interface SidebarItem {
  id: ResearchMode;
  name: string;
  icon: React.ReactNode;
  description: string;
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

interface Claim {
  id: string;
  text: string;
  contradicted: boolean;
  contradictionScore: number;
  evidences: Evidence[];
}

interface ContradictionCheckResponse {
  claims: Claim[];
  summary: string;
}

// Removed UpgradePrompt component - not needed for self-hosted version

// Removed ReferralBanner component - not needed for self-hosted version

// Add citation generation utility
const generateCitationText = (paper: Paper, format: string) => {
  const authors = paper.authors && paper.authors.length > 0
    ? paper.authors[0] + (paper.authors.length > 1 ? ' et al.' : '')
    : 'Unknown';
  const year = paper.published ? paper.published.substring(0, 4) : '';
  const title = paper.title;
  const url = paper.url || (paper.arxiv_id ? `https://arxiv.org/abs/${paper.arxiv_id}` : '');
  if (format === 'harvard') {
    return `${authors} (${year}) ${title}. Available at: ${url}`;
  } else if (format === 'acm') {
    return `${authors}. ${year}. ${title}. Retrieved from ${url}.`;
  }
  return `${title} - ${authors} (${year}). ${url}`;
};

// Component to render a citation dialog for a paper
function CitationDialog({ paper }: { paper: Paper }) {
  const [format, setFormat] = useState<string>('harvard');
  const citation = useMemo(() => generateCitationText(paper, format), [paper, format]);
  const { toast } = useToast();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Cite</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cite this paper</DialogTitle>
        </DialogHeader>
        <Select value={format} onValueChange={setFormat}>
          <SelectTrigger><SelectValue placeholder="Select format" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="harvard">Harvard</SelectItem>
            <SelectItem value="acm">ACM</SelectItem>
          </SelectContent>
        </Select>
        <Textarea key={format} readOnly className="mt-2" value={citation} />
        <DialogFooter>
          <Button onClick={() => { navigator.clipboard.writeText(citation); toast({ title: 'Citation copied' }); }}>
            Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ScholarExplorer() {
  // State declarations
  const [componentError, setComponentError] = useState<Error | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  const [submittedPrompt, setSubmittedPrompt] = useState<string>('');
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [chatExchanges, setChatExchanges] = useState<ChatExchange[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const params = useParams<{ mode?: string }>();
  const initialMode = params.mode ? (modeSlugMap[params.mode] || 'paper-search') : 'paper-search';
  const [currentMode, setCurrentMode] = useState<ResearchMode>(initialMode);
  const [selectedModelId, setSelectedModelId] = useState<string>('nineveh');
  const [availableModels, setAvailableModels] = useState<AIModel[]>([
    {
      id: 'nineveh',
      name: 'Nineveh',
      description: 'Our lightweight model optimized for fast scholarly research',
      icon: <LucideCloudLightning className="h-4 w-4 mr-2" />
    },
    {
      id: 'alexandria',
      name: 'Alexandria',
      description: 'Our advanced model with reasoning capabilities suitable for complex queries and deeper analysis',
      icon: <Brain className="h-4 w-4 mr-2" />
    }
  ]);
  const scrollableContentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [contradictionText, setContradictionText] = useState<string>('');
  const [isCheckingContradictions, setIsCheckingContradictions] = useState<boolean>(false);
  const [contradictionResults, setContradictionResults] = useState<ContradictionCheckResponse | null>(null);
  const [contradictionError, setContradictionError] = useState<string | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isAnalyzingData, setIsAnalyzingData] = useState<boolean>(false);
  const [dataAnalysisResults, setDataAnalysisResults] = useState<DataAnalysisResult | null>(null);
  const [dataAnalysisError, setDataAnalysisError] = useState<string | null>(null);
  const [citationNetworkData, setCitationNetworkData] = useState<{ nodes: any[], links: any[] } | null>(null);
  const [isBuildingNetwork, setIsBuildingNetwork] = useState<boolean>(false);
  const [citationNetworkError, setCitationNetworkError] = useState<string | null>(null);
  const [citationPaperId, setCitationPaperId] = useState<string>('');
  const [parsedPDFData, setParsedPDFData] = useState<any | null>(null);
  const [isUploadingPDF, setIsUploadingPDF] = useState<boolean>(false);
  const [pdfUploadError, setPdfUploadError] = useState<string | null>(null);
  const { toast } = useToast();

  // State to track if user has manually selected a model (to prevent auto-switching)
  const [hasUserManuallySelectedModel, setHasUserManuallySelectedModel] = useState<boolean>(false);

  const [, navigate] = useLocation();

  // All models are always available in the open-source version
  const canCurrentlyAffordSelectedModel = useCallback((): boolean => {
    return true; // No credit restrictions in open-source version
  }, []);

  // Models are statically defined - no need to fetch

  // No need to fetch models or credits - models are statically defined and no credit system

  // No model selection logic needed - all models are always available

  // No credit monitoring needed

  const sidebarItems: SidebarItem[] = [
    {
      id: 'paper-search',
      name: 'Paper Search',
      icon: <SearchIcon className="h-5 w-5" />,
      description: 'Search for academic papers'
    },
    {
      id: 'pdf-upload',
      name: 'PDF Upload',
      icon: <FileText className="h-5 w-5" />,
      description: 'Upload and parse PDF papers'
    },
    {
      id: 'citation-network',
      name: 'Citation Network',
      icon: <Network className="h-5 w-5" />,
      description: 'Visualize citation relationships'
    },
    {
      id: 'contradiction-checker',
      name: 'Contradiction Checker',
      icon: <AlertTriangle className="h-5 w-5" />,
      description: 'Find conflicting research findings'
    },
    {
      id: 'data-analysis',
      name: 'Data Analysis Tools',
      icon: <BarChart3 className="h-5 w-5" />,
      description: 'Analyze research data'
    },
    {
      id: 'gap-analysis',
      name: 'Research Gap Analysis',
      icon: <Lightbulb className="h-5 w-5" />,
      description: 'Identify gaps in current research'
    },
    {
      id: 'suggested-reading',
      name: 'Suggested Reading',
      icon: <BookOpen className="h-5 w-5" />,
      description: 'Discover new relevant papers'
    }
  ];

  const {
    refetch: fetchLLMResponse,
    isPending: isLoadingLLMResponseFromQuery,
    status
  } = useQuery<LLMSearchResponse, Error>({
    // Only key on submittedPrompt to prevent refetch when sessionId updates
    queryKey: ['llmScholarSearch', submittedPrompt],
    queryFn: useCallback(async (): Promise<LLMSearchResponse> => {
      const trimmedQuery = submittedPrompt.trim();
      if (!trimmedQuery) {
        throw new Error("Query function called with empty prompt.");
      }
      try {
        const results = await getLLMAssistedSearchResult(trimmedQuery, sessionId, selectedModelId);
        if (results.sessionId) {
          setSessionId(results.sessionId);
        }
        setChatExchanges(prev =>
          prev.map(ex =>
            (ex.prompt === trimmedQuery && ex.modelIdForQuery === selectedModelId && ex.isPending)
              ? { ...ex, llmResponse: results, error: null, isPending: false }
              : ex
          )
        );
        // No credit updates needed in open-source version 
        return results;
      } catch (err: any) {
        if (err.name === 'CancelledError') {
          // console.log('[ScholarExplorer] Query was cancelled by React Query.');
        } else {
          const errorToSet = err instanceof Error ? err : new Error('Failed to get response from AI assistant');
          setChatExchanges(prev =>
            prev.map(ex =>
              (ex.prompt === trimmedQuery && ex.modelIdForQuery === selectedModelId && ex.isPending)
                ? { ...ex, llmResponse: null, error: errorToSet, isPending: false }
                : ex
            )
          );
        }
        throw err;
      }
    }, [submittedPrompt, sessionId, selectedModelId]),
    enabled: !!submittedPrompt.trim(),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    retry: false
  });

  const isCurrentQueryLoading = isLoadingLLMResponseFromQuery && !!submittedPrompt.trim();

  // console.log(
  //   '[ScholarExplorer] Render. isLoadingFromQuery:', isLoadingLLMResponseFromQuery, 
  //   'isCurrentQueryLoading:', isCurrentQueryLoading,
  //   'status:', status, 
  //   'submittedPrompt:', `"${submittedPrompt}"`,
  //   'currentPrompt:', `"${currentPrompt}"`,
  //   'model:', selectedModelId,
  //   'chatExchanges:', chatExchanges
  // );

  useEffect(() => {
    if (scrollableContentRef.current) {
      scrollableContentRef.current.scrollTop = scrollableContentRef.current.scrollHeight;
    }
  }, [chatExchanges]);

  const handleToggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleModeChange = (mode: ResearchMode) => {
    setCurrentMode(mode);
    const slug = modeToSlugMap[mode];
    navigate(`/research/${slug}`);
  };

  // Sync URL changes to state (for browser back/forward)
  useEffect(() => {
    const urlMode = params.mode ? (modeSlugMap[params.mode] || 'paper-search') : 'paper-search';
    if (urlMode !== currentMode) {
      setCurrentMode(urlMode);
    }
  }, [params.mode]);

  const handlePromptChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentPrompt(event.target.value);
  };

  // Update handleModelChange to set the manual selection flag
  const handleModelChange = (modelId: string) => {
    if (modelId !== selectedModelId) {
      setSelectedModelId(modelId);
      setHasUserManuallySelectedModel(true); // User has manually selected a model
      // console.log(`[handleModelChange] Model changed to: ${modelId} (manual selection)`);
    }
  };

  const handleSubmitPrompt = () => {
    try {
      // No credit checks - all models freely available
      const trimmedPrompt = currentPrompt.trim();
      if (trimmedPrompt && !isCurrentQueryLoading) {
        // Optimistically submit - server will validate
        setSelectedPaper(null);
        setChatExchanges(prev => {
          const newExchange = {
            prompt: trimmedPrompt,
            llmResponse: null,
            error: null,
            isPending: true,
            modelIdForQuery: selectedModelId
          };
          const existingIdentical = prev.find(ex =>
            ex.prompt === trimmedPrompt &&
            ex.modelIdForQuery === selectedModelId &&
            (ex.isPending || ex.llmResponse)
          );
          if (existingIdentical) return prev;
          const filtered = prev.filter(ex =>
            !(ex.prompt === trimmedPrompt && ex.modelIdForQuery === selectedModelId && ex.error)
          );
          return [...filtered, newExchange];
        });
        setSubmittedPrompt(trimmedPrompt);
        // Immediately trigger the AI assistant query
        fetchLLMResponse();
        setCurrentPrompt('');
        inputRef.current?.focus();
      }
    } catch (error) {
      console.error("[SUBMIT] Critical error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Something went wrong. Please try again."
      });
    }
  };

  const handleCancelQuery = async () => {
    // console.log("[ScholarExplorer] Cancel button clicked for prompt:", submittedPrompt, "model:", selectedModelId);
    try {
      await queryClient.cancelQueries({ queryKey: ['llmScholarSearch', submittedPrompt] });
      // console.log("[ScholarExplorer] Query cancellation requested via queryClient.");
    } catch (e) {
      console.error("[ScholarExplorer] Error calling queryClient.cancelQueries:", e);
    }

    setChatExchanges(prev =>
      prev.filter(ex =>
        !(ex.prompt === submittedPrompt && ex.modelIdForQuery === selectedModelId && ex.isPending)
      )
    );
    setSubmittedPrompt('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle Enter key to submit
    if (event.key === 'Enter') {
      event.preventDefault(); // Always prevent form submission

      // No credit checks - directly submit if not already processing
      if (!isCurrentQueryLoading) {
        handleSubmitPrompt();
      }
    }
  };

  const handleSelectPaper = (paper: Paper) => {
    setSelectedPaper(paper);
  };

  const renderMarkdown = (text: string) => {
    const boldRegex = /\*\*(.*?)\*\*/g;
    const italicRegex = /\*(.*?)\*/g;
    const linkRegex = /\[(.*?)\]\((.*?)\)/g;
    const bulletRegex = /^\s*-\s+(.*)/gm;

    let html = text
      .replace(boldRegex, '<strong>$1</strong>')
      .replace(italicRegex, '<em>$1</em>')
      .replace(linkRegex, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">$1</a>')
      .replace(bulletRegex, '<div class="flex"><span class="mr-2 text-primary">•</span><span>$1</span></div>');

    const lines = html.split('\n');
    html = lines.map(line => line.trim() ? `<div class="mb-1">${line}</div>` : '<div class="mb-1">&nbsp;</div>').join('');
    return html;
  };

  const renderExchange = (exchange: ChatExchange, index: number) => {
    const modelInfo = availableModels.find(m => m.id === exchange.modelIdForQuery);
    const modelName = modelInfo?.name || (exchange.modelIdForQuery === 'nineveh' ? 'Nineveh (gpt-5-mini)' : 'Alexandria (gpt-5.2)');

    const isActiveQuery = exchange.isPending && exchange.prompt === submittedPrompt && exchange.modelIdForQuery === selectedModelId;

    return (
      <div key={`exchange-${index}-${exchange.modelIdForQuery}`} className="w-full mx-auto pt-0 pb-6 px-2 border-b border-theme-border last:border-b-0">
        {exchange.prompt && (
          <div className="sticky top-0 z-10 pt-3 pb-4 bg-background">
            <div className="p-4 border-l-4 border-theme-primary bg-theme-card rounded-md shadow-sm">
              <h2 className="text-base font-semibold font-sans text-theme-foreground">{exchange.prompt}</h2>
            </div>
          </div>
        )}

        <div className="mt-8">
          {(exchange.isPending) && (
            <div className="text-center py-10">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
              <p className="text-muted-foreground text-lg">Generating response using {modelName}...</p>
            </div>
          )}

          {exchange.error && (
            <div className="bg-destructive/10 border border-destructive text-destructive-foreground p-4 rounded-md">
              <h3 className="font-bold text-lg mb-2">Error: {exchange.error.message === "Query cancelled by user." ? "Cancelled" : "Request Failed"}</h3>
              <p>{exchange.error.message === "Query cancelled by user." ? "The query was cancelled." : exchange.error.message || "An unknown error occurred."}</p>
              {exchange.error.message !== "Query cancelled by user." && (
                <Button variant="outline" size="sm" onClick={() => {
                  const promptToRetry = exchange.prompt;
                  const modelToRetry = exchange.modelIdForQuery;
                  setChatExchanges(prev => prev.filter(ex => !(ex.prompt === promptToRetry && ex.modelIdForQuery === modelToRetry && ex.error)));
                  setSelectedModelId(modelToRetry);
                  setCurrentPrompt(promptToRetry);
                  setChatExchanges(prev => [
                    ...prev,
                    { prompt: promptToRetry, llmResponse: null, error: null, isPending: true, modelIdForQuery: modelToRetry }
                  ]);
                  setSubmittedPrompt(promptToRetry);
                }} className="mt-3 border-destructive text-destructive hover:bg-destructive/20">
                  Try Again
                </Button>
              )}
            </div>
          )}

          {exchange.llmResponse && (
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
              <div className="lg:w-2/3 prose prose-invert max-w-none prose-p:text-foreground prose-strong:text-foreground prose-em:text-foreground prose-a:text-primary hover:prose-a:underline prose-headings:text-foreground">
                <div className="flex justify-between items-center mb-3 border-b border-theme-border pb-2">
                  <h3 className="text-xl font-semibold text-foreground">Answer</h3>
                  {modelInfo && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {modelInfo.icon || <LucideCloudLightning className="h-3.5 w-3.5" />}
                      <span>{modelName}</span>
                    </div>
                  )}
                </div>
                <div
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(exchange.llmResponse.llmResponseText) }}
                />
              </div>
              <div className="lg:w-1/3 space-y-4">
                <h3 className="text-xl font-semibold text-foreground mb-3 border-b border-theme-border pb-2">
                  Sources
                  {exchange.llmResponse.totalPapers !== undefined && exchange.llmResponse.papers.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({exchange.llmResponse.papers.length} of {exchange.llmResponse.totalPapers} shown)
                    </span>
                  )}
                </h3>
                {exchange.llmResponse.papers && exchange.llmResponse.papers.length > 0 ? (
                  exchange.llmResponse.papers.map((paper: Paper) => (
                    <div
                      key={paper.doi || paper.arxiv_id || paper.title}
                      className="p-3 border border-theme-border rounded-lg bg-card hover:bg-muted/50 transition-colors duration-150 shadow-sm"
                    >
                      <h4
                        className="font-semibold text-md cursor-pointer text-primary hover:underline"
                        onClick={() => handleSelectPaper(paper)}
                      >
                        {paper.title}
                      </h4>
                      <div className="text-xs text-muted-foreground mt-1">
                        {paper.authors.slice(0, 3).join(', ')}{paper.authors.length > 3 ? ' et al.' : ''}
                        {paper.published && ` - ${paper.published.substring(0, 4)}`}
                      </div>
                      {paper.citations !== undefined && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Citations: {paper.citations}
                        </div>
                      )}
                      <p className="mt-1.5 text-sm text-foreground/90 line-clamp-3">{paper.summary}</p>
                      {paper.url && (
                        <a
                          href={paper.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline mt-2 inline-flex items-center"
                        >
                          View Paper <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      )}
                      {paper.fieldOfStudy && paper.fieldOfStudy.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {paper.fieldOfStudy.slice(0, 3).map((field: string) => (
                            <span key={field} className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-[10px] font-medium">
                              {field}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-2 flex space-x-2">
                        <CitationDialog paper={paper} />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm">No sources found for this response.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleCheckContradictions = async () => {
    if (!contradictionText.trim() || isCheckingContradictions) return;

    setIsCheckingContradictions(true);
    setContradictionResults(null);
    setContradictionError(null);

    try {
      // console.log(`[ScholarExplorer] Checking contradictions using model: ${selectedModelId}`);
      const resultData = await checkContradictions(contradictionText, selectedModelId);
      setContradictionResults(resultData);
      // console.log(`[ScholarExplorer] Contradiction check complete:`, resultData);
    } catch (error: any) {
      console.error('[ScholarExplorer] Error checking contradictions:', error);
      setContradictionError(error.message || 'An error occurred while checking contradictions');
    } finally {
      setIsCheckingContradictions(false);
    }
  };

  const renderContradictionChecker = () => {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-4">Scientific Contradiction Checker</h1>
        <p className="text-muted-foreground mb-6">
          Paste scientific text to check for claims that may be contradicted by existing research.
        </p>

        <div className="mb-6">
          <Textarea
            placeholder="Paste scientific text, abstract, or claims here..."
            className="min-h-[200px] text-md"
            value={contradictionText}
            onChange={(e) => setContradictionText(e.target.value)}
            disabled={isCheckingContradictions}
          />

          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center">
              <Select
                value={selectedModelId}
                onValueChange={handleModelChange}
                disabled={isCheckingContradictions}
              >
                <SelectTrigger className="w-auto min-w-[135px] h-8 text-xs border-none focus:ring-0 bg-muted/50 mr-1">
                  <SelectValue placeholder="Select model">
                    <div className="flex items-center gap-1">
                      {availableModels.find(m => m.id === selectedModelId)?.icon}
                      <span className="truncate">{availableModels.find(m => m.id === selectedModelId)?.name}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map(model => (
                    <SelectItem key={model.id} value={model.id} className="text-xs">
                      <div className="flex items-start">
                        <div className="flex-shrink-0 w-5 mt-0.5">
                          {model.icon || <LucideCloudLightning className="h-4 w-4" />}
                        </div>
                        <div className="ml-2">
                          <div className="font-medium">{model.name}</div>
                          <div className="text-muted-foreground text-[10px]">{model.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground ml-3 italic">
                If analysis is insufficient, use Alexandria
              </span>
            </div>

            <Button
              onClick={handleCheckContradictions}
              disabled={!contradictionText.trim() || isCheckingContradictions}
              className={cn(
                "bg-primary hover:bg-primary/90 text-primary-foreground",
                isCheckingContradictions && "opacity-70 cursor-not-allowed"
              )}
            >
              {isCheckingContradictions ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Check Contradictions
                </>
              )}
            </Button>
          </div>
        </div>

        {contradictionError && (
          <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-4 mb-6">
            <h3 className="font-semibold">Error</h3>
            <p>{contradictionError}</p>
          </div>
        )}

        {contradictionResults && (
          <div className="mt-8 space-y-6">
            <Card className="border border-theme-border">
              <CardHeader>
                <CardTitle>Analysis Summary</CardTitle>
                <CardDescription>
                  {contradictionResults.claims.filter(c => c.contradicted).length} of {contradictionResults.claims.length} claims may be contradicted by existing research
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-foreground whitespace-pre-line">
                  {contradictionResults.summary}
                </div>
              </CardContent>
            </Card>

            <h2 className="text-xl font-bold mt-8">Analyzed Claims</h2>

            <Tabs defaultValue="all" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="all">All Claims ({contradictionResults.claims.length})</TabsTrigger>
                <TabsTrigger value="contradicted">
                  Contradicted ({contradictionResults.claims.filter(c => c.contradicted).length})
                </TabsTrigger>
                <TabsTrigger value="supported">
                  Supported ({contradictionResults.claims.filter(c => !c.contradicted).length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-4">
                {contradictionResults.claims.map(claim => renderClaimCard(claim))}
              </TabsContent>

              <TabsContent value="contradicted" className="space-y-4">
                {contradictionResults.claims
                  .filter(claim => claim.contradicted)
                  .map(claim => renderClaimCard(claim))}
              </TabsContent>

              <TabsContent value="supported" className="space-y-4">
                {contradictionResults.claims
                  .filter(claim => !claim.contradicted)
                  .map(claim => renderClaimCard(claim))}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    );
  };

  const renderClaimCard = (claim: Claim) => {
    return (
      <Card key={claim.id} className={cn(
        "border",
        claim.contradicted
          ? "border-destructive/50 bg-destructive/5"
          : "border-theme-border"
      )}>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-md font-semibold">
              {claim.text}
            </CardTitle>
            <CardDescription>
              {claim.contradicted
                ? "This claim may be contradicted by existing research"
                : "This claim appears to be supported by existing research"}
            </CardDescription>
          </div>
          <Badge
            variant={claim.contradicted ? "destructive" : "secondary"}
            className="ml-2 whitespace-nowrap"
          >
            {claim.contradicted ? "Contradicted" : "Supported"}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Support</span>
              <span>Contradiction</span>
            </div>
            <div className="relative h-2">
              <Progress
                value={claim.contradictionScore * 100}
                className={cn(
                  "h-2 w-full",
                  claim.contradictionScore > 0.7
                    ? "bg-muted text-destructive"
                    : "bg-muted text-primary"
                )}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0.0</span>
              <span>0.5</span>
              <span>1.0</span>
            </div>
          </div>

          <h4 className="text-sm font-medium mb-2">Evidence:</h4>
          <div className="space-y-3">
            {claim.evidences.map(evidence => (
              <div
                key={evidence.id}
                className={cn(
                  "p-3 text-sm rounded-md border",
                  evidence.isContradicting
                    ? "border-destructive/30 bg-destructive/10"
                    : "border-theme-border bg-muted/50"
                )}
              >
                <div className="flex justify-between mb-1">
                  <span className="font-medium">{evidence.source}</span>
                  <Badge
                    variant={evidence.isContradicting ? "outline" : "secondary"}
                    className="text-[10px] h-5"
                  >
                    Score: {evidence.contradictionScore.toFixed(2)}
                  </Badge>
                </div>
                <p>{evidence.text}</p>
                {evidence.url && (
                  <a
                    href={evidence.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline mt-2 inline-flex items-center"
                  >
                    View Source <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const handleCsvFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setCsvFile(files[0]);
      setDataAnalysisError(null);
    }
  };

  const handleAnalyzeData = async () => {
    if (!csvFile || isAnalyzingData) return;

    setIsAnalyzingData(true);
    setDataAnalysisResults(null);
    setDataAnalysisError(null);

    try {
      // console.log(`[ScholarExplorer] Analyzing CSV file: ${csvFile.name}`);
      const results = await analyzeCSVFile(csvFile);
      setDataAnalysisResults(results);
      // console.log(`[ScholarExplorer] Data analysis complete:`, results);
    } catch (error: any) {
      console.error('[ScholarExplorer] Error analyzing data:', error);
      setDataAnalysisError(error.message || 'An error occurred while analyzing the data');
    } finally {
      setIsAnalyzingData(false);
    }
  };

  const renderDataAnalysis = () => {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-4">Data Analysis Tools</h1>
        <p className="text-muted-foreground mb-6">
          Upload a CSV file to analyze and get insights about your data.
        </p>

        <div className="mb-6">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvFileChange}
                  disabled={isAnalyzingData}
                  className="w-full"
                />
              </div>
              <Button
                onClick={handleAnalyzeData}
                disabled={!csvFile || isAnalyzingData}
                className={cn(
                  "bg-primary hover:bg-primary/90 text-primary-foreground",
                  isAnalyzingData && "opacity-70 cursor-not-allowed"
                )}
              >
                {isAnalyzingData ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Analyze Data
                  </>
                )}
              </Button>
            </div>

            {csvFile && (
              <div className="text-sm text-muted-foreground">
                Selected file: <span className="font-medium">{csvFile.name}</span> ({(csvFile.size / 1024).toFixed(1)} KB)
              </div>
            )}
          </div>
        </div>

        {dataAnalysisError && (
          <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-4 mb-6">
            <h3 className="font-semibold">Error</h3>
            <p>{dataAnalysisError}</p>
          </div>
        )}

        {dataAnalysisResults && (
          <div className="mt-8 space-y-6">
            <Card className="border border-theme-border">
              <CardHeader>
                <CardTitle>File Summary</CardTitle>
                <CardDescription>
                  {dataAnalysisResults.fileName} - {dataAnalysisResults.rowCount} rows, {dataAnalysisResults.columnCount} columns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-foreground whitespace-pre-line">
                  {dataAnalysisResults.summary}
                </div>
              </CardContent>
            </Card>

            <div>
              <h2 className="text-xl font-bold mb-4">Key Insights</h2>
              <div className="space-y-3">
                {dataAnalysisResults.insights.slice(0, 10).map((insight, index) => (
                  <div
                    key={`insight-${index}`}
                    className={cn(
                      "p-3 rounded-md border",
                      insight.type === 'anomaly'
                        ? "border-destructive/30 bg-destructive/10"
                        : insight.type === 'correlation'
                          ? "border-primary/30 bg-primary/10"
                          : "border-theme-border bg-muted/50"
                    )}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium capitalize text-sm">
                        {insight.type}
                        {insight.relatedColumns && insight.relatedColumns.length > 0 && (
                          <span className="text-muted-foreground ml-2 font-normal">
                            ({insight.relatedColumns.join(', ')})
                          </span>
                        )}
                      </span>
                      <Badge variant="outline" className="text-[10px] h-5">
                        Importance: {insight.importance}/10
                      </Badge>
                    </div>
                    <p className="text-sm">{insight.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-4">Column Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dataAnalysisResults.columns.map((column, index) => (
                  <Card key={`column-${index}`} className="border border-theme-border">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-md font-semibold">{column.name}</CardTitle>
                        <Badge className="capitalize">{column.type}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {column.type === 'numeric' ? (
                        <div className="space-y-2 text-sm">
                          {column.summary.min !== undefined && column.summary.max !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Range:</span>
                              <span>{column.summary.min} to {column.summary.max}</span>
                            </div>
                          )}
                          {column.summary.mean !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Mean:</span>
                              <span>{column.summary.mean.toFixed(2)}</span>
                            </div>
                          )}
                          {column.summary.median !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Median:</span>
                              <span>{column.summary.median.toFixed(2)}</span>
                            </div>
                          )}
                          {column.summary.missingValues !== undefined && column.summary.missingValues > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Missing Values:</span>
                              <span>{column.summary.missingValues}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2 text-sm">
                          {column.summary.uniqueValues !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Unique Values:</span>
                              <span>{column.summary.uniqueValues}</span>
                            </div>
                          )}
                          {column.summary.mostCommonValue !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Most Common:</span>
                              <span>{column.summary.mostCommonValue} ({column.summary.mostCommonCount})</span>
                            </div>
                          )}
                          {column.summary.missingValues !== undefined && column.summary.missingValues > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Missing Values:</span>
                              <span>{column.summary.missingValues}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPDFUpload = () => {
    const handleFileUpload = async (file: File) => {
      setIsUploadingPDF(true);
      setParsedPDFData(null);
      setPdfUploadError(null);
      toast({ title: 'Processing PDF...', description: file.name });

      try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/pdf/upload', {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to parse PDF (${response.status})`);
        }
        const result = await response.json();
        setParsedPDFData(result.data);
        toast({
          title: 'PDF Parsed Successfully',
          description: `${result.data.title} - ${result.data.references?.length || 0} references`
        });
      } catch (err: any) {
        const errorMessage = err.message || 'An unexpected error occurred';
        setPdfUploadError(errorMessage);
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
      } finally {
        setIsUploadingPDF(false);
      }
    };

    return (
      <div className="p-4 pb-36 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2 text-foreground">PDF Upload & Analysis</h1>
        <p className="text-muted-foreground mb-6">
          Upload a PDF to extract text, metadata, authors, and references from academic papers.
        </p>

        <div className="border-2 border-dashed rounded-lg p-8 text-center transition-colors border-muted-foreground/25 hover:border-muted-foreground/50 mb-6">
          {isUploadingPDF ? (
            <>
              <Loader2 className="h-10 w-10 mx-auto text-primary mb-4 animate-spin" />
              <p className="text-sm text-muted-foreground">Processing PDF...</p>
            </>
          ) : (
            <>
              <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Drag and drop a PDF file here, or click to browse
              </p>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="hidden"
                id="pdf-upload-input"
              />
              <Button asChild variant="outline" size="sm">
                <label htmlFor="pdf-upload-input" className="cursor-pointer">
                  Select PDF
                </label>
              </Button>
            </>
          )}
        </div>

        {pdfUploadError && (
          <div className="mb-6 bg-destructive/10 border border-destructive/30 text-destructive rounded-md p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold">Error Processing PDF</h3>
                <p className="text-sm mt-1">{pdfUploadError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 border-destructive text-destructive hover:bg-destructive/20"
                  onClick={() => setPdfUploadError(null)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        )}

        {parsedPDFData ? (
          <div className="space-y-4">
            {/* Header with title and stats */}
            <Card className="border-theme-border">
              <CardHeader>
                <CardTitle className="text-xl">{parsedPDFData.title}</CardTitle>
                <CardDescription className="text-base">
                  {parsedPDFData.metadata?.pageCount} pages • {parsedPDFData.metadata?.wordCount?.toLocaleString()} words • {parsedPDFData.references?.length || 0} references
                </CardDescription>
                {parsedPDFData.authors?.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    By: {parsedPDFData.authors.join(', ')}
                  </p>
                )}
              </CardHeader>
            </Card>

            {/* Abstract */}
            {parsedPDFData.abstract && (
              <Card className="border-theme-border">
                <CardHeader>
                  <CardTitle>Abstract</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{parsedPDFData.abstract}</p>
                </CardContent>
              </Card>
            )}

            {/* References with domains */}
            {parsedPDFData.references?.length > 0 && (
              <Card className="border-theme-border">
                <CardHeader>
                  <CardTitle>References ({parsedPDFData.references.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {parsedPDFData.references.map((ref: any, i: number) => {
                    // Handle both string and object formats
                    const isObject = typeof ref === 'object';
                    const title = isObject ? ref.title : '';
                    const authors = isObject ? ref.authors : '';
                    const url = isObject ? ref.url : null;
                    const doi = isObject ? ref.doi : null;
                    const fullText = isObject ? ref.full : ref;
                    let domain = null;
                    if (url) {
                      try { domain = new URL(url).hostname.replace('www.', ''); } catch { }
                    }

                    return (
                      <div key={i} className="p-3 bg-muted/20 rounded-lg">
                        {title && <h4 className="font-medium text-foreground mb-1">{title}</h4>}
                        {authors && <p className="text-sm text-muted-foreground mb-1">By: {authors}</p>}
                        <p className="text-xs text-muted-foreground">{fullText}</p>
                        {(domain || doi) && (
                          <div className="mt-2 flex gap-3">
                            {domain && (
                              <a href={url!} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                                {domain}
                              </a>
                            )}
                            {doi && (
                              <a href={`https://doi.org/${doi}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                                doi.org/{doi}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Full Text */}
            {parsedPDFData.fullText && (
              <Card className="border-theme-border">
                <CardHeader>
                  <CardTitle>Full Extracted Text</CardTitle>
                  <CardDescription>{parsedPDFData.metadata?.wordCount?.toLocaleString()} words</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[500px] overflow-y-auto bg-muted/20 p-4 rounded">
                    <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{parsedPDFData.fullText}</pre>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button variant="outline" onClick={() => setParsedPDFData(null)} className="w-full">
              Upload Another PDF
            </Button>
          </div>
        ) : (
          <Card className="border-theme-border">
            <CardHeader>
              <CardTitle>Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>✓ Extract title, authors, and abstract</p>
              <p>✓ Extract full text content</p>
              <p>✓ Identify references and citations</p>
              <p>✓ AI-powered metadata extraction</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderCitationNetwork = () => {
    const handleBuildNetwork = async () => {
      if (!citationPaperId.trim()) {
        toast({ title: 'Error', description: 'Please enter a paper ID', variant: 'destructive' });
        return;
      }

      setIsBuildingNetwork(true);
      setCitationNetworkData(null);
      setCitationNetworkError(null);
      toast({ title: 'Building citation network...', description: `Paper: ${citationPaperId}` });

      try {
        const response = await fetch(`/api/citations/${encodeURIComponent(citationPaperId)}/network?depth=1&maxNodes=30`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to fetch citation network (${response.status})`);
        }
        const result = await response.json();
        setCitationNetworkData(result.data);
        toast({
          title: 'Citation Network Built',
          description: `${result.data?.nodes?.length || 0} papers found`
        });
      } catch (err: any) {
        const errorMessage = err.message || 'An unexpected error occurred';
        setCitationNetworkError(errorMessage);
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
      } finally {
        setIsBuildingNetwork(false);
      }
    };

    return (
      <div className="p-4 pb-36 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2 text-foreground">Citation Network</h1>
        <p className="text-muted-foreground mb-6">
          Visualize citation relationships between papers. Enter a paper ID to explore its citation network.
        </p>

        <div className="flex gap-2 mb-6">
          <Input
            placeholder="Enter Semantic Scholar Paper ID or ArXiv ID..."
            className="flex-1"
            value={citationPaperId}
            onChange={(e) => setCitationPaperId(e.target.value)}
            disabled={isBuildingNetwork}
          />
          <Button onClick={handleBuildNetwork} disabled={isBuildingNetwork || !citationPaperId.trim()}>
            {isBuildingNetwork ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Building...
              </>
            ) : (
              <>
                <Network className="h-4 w-4 mr-2" />
                Build Network
              </>
            )}
          </Button>
        </div>

        {citationNetworkError && (
          <div className="mb-6 bg-destructive/10 border border-destructive/30 text-destructive rounded-md p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold">Error Building Citation Network</h3>
                <p className="text-sm mt-1">{citationNetworkError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 border-destructive text-destructive hover:bg-destructive/20"
                  onClick={() => setCitationNetworkError(null)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        )}

        {citationNetworkData && citationNetworkData.nodes && citationNetworkData.nodes.length > 0 ? (
          <div className="space-y-4">
            <Card className="border-theme-border">
              <CardHeader className="pb-2">
                <CardTitle>Citation Network Graph</CardTitle>
                <CardDescription>
                  {citationNetworkData.nodes.length} papers, {citationNetworkData.links?.length || 0} connections. Click a node to select it.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-[500px] w-full">
                  <GraphVisualization
                    graphData={citationNetworkData}
                    isLoading={isBuildingNetwork}
                    selectedPaper={selectedPaper}
                    onNodeClick={(node) => {
                      if (node.paper) {
                        setSelectedPaper(node.paper);
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <h3 className="text-lg font-semibold mt-6 mb-3">Papers in Network</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {citationNetworkData.nodes.map((node: any) => (
                <Card key={node.id} className={cn(
                  "border-theme-border hover:border-primary/50 transition-colors cursor-pointer",
                  selectedPaper?.arxiv_id === node.id && "border-primary ring-1 ring-primary"
                )}
                  onClick={() => node.paper && setSelectedPaper(node.paper)}>
                  <CardContent className="p-3">
                    <h4 className="font-medium text-foreground text-sm line-clamp-2">{node.label || node.paper?.title || node.id}</h4>
                    {node.paper?.authors && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {node.paper.authors.slice(0, 2).join(', ')}{node.paper.authors.length > 2 ? ' et al.' : ''}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <Card className="border-theme-border">
            <CardHeader>
              <CardTitle>Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>✓ Interactive D3.js force-directed graph</p>
              <p>✓ View papers that cite a given paper</p>
              <p>✓ View papers that a paper references</p>
              <p>✓ Click nodes to see paper details</p>
              <p>✓ Drag nodes to rearrange the graph</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderAllResponses = () => {
    if (selectedPaper) return renderPaperDetails();

    if (currentMode !== 'paper-search') {
      if (currentMode === 'contradiction-checker') {
        return renderContradictionChecker();
      }

      if (currentMode === 'data-analysis') {
        return renderDataAnalysis();
      }

      if (currentMode === 'pdf-upload') {
        return renderPDFUpload();
      }

      if (currentMode === 'citation-network') {
        return renderCitationNetwork();
      }

      return (
        <div className="text-center text-muted-foreground pt-10 flex flex-col items-center">
          <div className="h-16 w-16 mx-auto mb-4 text-muted-foreground/70 flex items-center justify-center">
            {sidebarItems.find(item => item.id === currentMode)?.icon || <Sparkles className="h-10 w-10" />}
          </div>
          <p className="text-lg">{sidebarItems.find(item => item.id === currentMode)?.name || "Feature"} coming soon</p>
          <p className="text-sm">This feature is coming soon</p>
        </div>
      );
    }

    if (chatExchanges.length === 0) {
      return (
        <Card className="bg-theme-card border-theme-border mt-6">
          <CardContent className="text-center py-12">
            <SearchIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground/70" />
            <p className="text-lg text-theme-foreground">Ask me to find academic papers.</p>
            <p className="text-sm text-theme-muted-foreground mt-1">e.g., "5 recent papers on LLM agents"</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-0">
        {chatExchanges.map((exchange, index) => renderExchange(exchange, index))}
        <div className="h-36" aria-hidden="true"></div>
      </div>
    );
  };

  const renderPaperDetails = () => {
    if (!selectedPaper) return null;
    return (
      <div className="p-4 pb-36">
        <PaperDetails paper={selectedPaper} connectedPapers={[]} onClose={() => setSelectedPaper(null)} onSelectRelatedPaper={() => { }} />
      </div>
    );
  };

  const renderSidebar = () => {
    return (
      <div
        className={cn(
          "fixed left-0 top-20 bottom-0 bg-theme-card border-r border-theme-border transition-all duration-200 flex flex-col shadow-lg z-30",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        <div className="py-2 px-2 flex items-center justify-between">
          {!sidebarCollapsed && (
            <span className="text-xs font-medium text-muted-foreground">Research Tools</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleSidebar}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="h-6 w-6"
          >
            {sidebarCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </Button>
        </div>

        <div className="flex-grow overflow-y-auto py-1">
          <nav className="space-y-1 px-1">
            {sidebarItems.map((item) => (
              <Button
                key={item.id}
                variant={currentMode === item.id ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start h-8",
                  currentMode === item.id ? "bg-muted hover:bg-muted/80" : "hover:bg-background/80",
                  sidebarCollapsed ? "px-2" : "px-2"
                )}
                onClick={() => handleModeChange(item.id)}
                title={sidebarCollapsed ? item.name : undefined}
              >
                <span className={sidebarCollapsed ? "" : "mr-2"}>{item.icon}</span>
                {!sidebarCollapsed && <span className="text-xs truncate">{item.name}</span>}
              </Button>
            ))}
          </nav>
        </div>

        {!sidebarCollapsed && (
          <div className="p-2 border-t border-theme-border">
            <div className="text-[10px] text-muted-foreground">
              PlaintextAI v1.0
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderChatInputBar = () => {
    if (currentMode !== 'paper-search') return null;

    // Simplify and enhance isProcessing check to be absolutely clear
    const isProcessing = isCurrentQueryLoading === true;

    const canUseCurrentlySelectedModel = canCurrentlyAffordSelectedModel();
    const selectedModelDetails = availableModels.find(m => m.id === selectedModelId);

    return (
      <div className="fixed bottom-4 inset-x-0 z-10 w-full px-4">
        <div className="max-w-3xl mx-auto relative">
          <div className="bg-card rounded-lg shadow-lg border border-theme-border overflow-hidden">  {/* Main input card */}
            <div className="flex items-center p-2">
              <SearchIcon className="h-4 w-4 text-muted-foreground ml-2" />
              <Input
                ref={inputRef}
                placeholder={
                  isProcessing
                    ? "Processing..."
                    : "Ask about academic papers..."
                }
                className={cn(
                  "flex-grow py-2 text-md bg-transparent border-none focus:ring-0 text-foreground h-9 text-sm mx-3",
                  isProcessing ? "placeholder-muted-foreground" :
                    canUseCurrentlySelectedModel ? "placeholder-muted-foreground" : "placeholder-destructive/80"
                )}
                value={currentPrompt}
                onChange={handlePromptChange}
                onKeyDown={handleKeyDown}
                disabled={isProcessing}
              />

              <Select
                value={selectedModelId}
                onValueChange={handleModelChange}
                disabled={isProcessing}
              >
                <SelectTrigger className="w-[135px] h-8 text-xs border-none focus:ring-0 bg-muted/50 mr-1">
                  <SelectValue placeholder="Select model">
                    <div className="flex items-center gap-1">
                      {selectedModelDetails?.icon}
                      <span className="truncate">{selectedModelDetails?.name || "Select Model"}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map(model => {
                    // All models always available in self-hosted version
                    const modelIsUsableInDropdown = true;

                    return (
                      <SelectItem
                        key={model.id}
                        value={model.id}
                        className="text-xs"
                      >
                        <div className="flex items-start">
                          <div className="flex-shrink-0 w-5 mt-0.5">
                            {model.icon || <LucideCloudLightning className="h-4 w-4" />}
                          </div>
                          <div className="ml-2">
                            <div className="font-medium">{model.name}</div>
                            <div className="text-muted-foreground text-[10px]">
                              {model.description}
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <Button
                onClick={handleSubmitPrompt}
                disabled={
                  isProcessing ||
                  !currentPrompt.trim() ||
                  !canUseCurrentlySelectedModel
                }
                className={cn(
                  "text-primary-foreground rounded-md min-w-[36px] h-8 px-2.5 mr-2",
                  isProcessing ? "bg-destructive hover:bg-destructive/90"
                    : (!canUseCurrentlySelectedModel || !currentPrompt.trim())
                      ? "bg-muted-foreground hover:bg-muted-foreground/90 cursor-not-allowed"
                      : "bg-primary hover:bg-primary/90"
                )}
                size="sm"
                title={
                  isProcessing
                    ? "Processing..."
                    : !currentPrompt.trim()
                      ? "Type a message first"
                      : "Search"
                }
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendIcon className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleTestDirectRoute = async () => { console.log("Testing direct route..."); try { const result = await testDirectRoute(); alert(`Result: ${result.message}`); } catch (e) { alert(`Error: ${e}`); } };
  const handleTestRouter = async () => { console.log("Testing router..."); try { const result = await testRouter(); alert(`Result: ${result.message}`); } catch (e) { alert(`Error: ${e}`); } };
  const handleTestDirectAiLikeRoute = async () => { console.log("Testing AI-like route..."); try { const result = await testDirectAiLikeRoute(); alert(`Result: ${result.llmResponseText}`); } catch (e) { alert(`Error: ${e}`); } };

  // Removed guest mode initialization - not needed for self-hosted version

  // Auto-run initial query from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('q');
    if (queryParam && queryParam.trim()) {
      // Prepare and send initial query
      setCurrentPrompt('');
      setSubmittedPrompt(queryParam);
      setTimeout(() => {
        setChatExchanges(prev => [
          ...prev,
          { prompt: queryParam, llmResponse: null, error: null, isPending: true, modelIdForQuery: selectedModelId }
        ]);
        fetchLLMResponse();
      }, 100);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [fetchLLMResponse, selectedModelId]);

  // Error handler for catching render/initialization errors
  useEffect(() => {
    try {
      // console.log("[INIT SafetyCheck] Component initializing...");
      // No additional logic needed - just ensuring the component can initialize
    } catch (error) {
      console.error("[INIT SafetyCheck] Critical error during component initialization:", error);
      setComponentError(error instanceof Error ? error : new Error(String(error)));
    }
  }, []);

  // Defensive rendering function to safely handle component errors
  if (componentError) {
    return (
      <MainLayout>
        <div className="h-full flex flex-col items-center justify-center p-8 bg-background text-foreground">
          <div className="max-w-lg border border-destructive/50 bg-destructive/10 rounded-lg p-6 text-center">
            <h2 className="text-xl font-bold mb-4">Something went wrong</h2>
            <p className="text-sm mb-4">
              {componentError.message || "An unknown error occurred while loading the Scholar Explorer."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-sm"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Safety wrapped render method
  try {
    return (
      <MainLayout>
        <div className="h-full flex overflow-hidden">
          <div className="flex flex-grow relative">
            {(() => {
              try {
                return renderSidebar();
              } catch (error) {
                console.error('[ScholarExplorer] Sidebar render error:', error);
                return <div className="text-destructive p-4">Sidebar error: {String(error)}</div>;
              }
            })()}
            <div
              className="flex-grow flex flex-col overflow-hidden"
              style={{ paddingLeft: sidebarCollapsed ? '66px' : '216px' }}
            >
              <div ref={scrollableContentRef} className="flex-grow overflow-y-auto">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                  <Card className="mb-6 bg-theme-card border-theme-border">
                    <CardHeader className="text-center">
                      <CardTitle className="text-3xl text-theme-foreground">Welcome to Scholar Explorer</CardTitle>
                      <CardDescription className="mt-2 text-theme-muted-foreground">Get started by asking a question or selecting a research mode.</CardDescription>
                    </CardHeader>
                  </Card>
                  {(() => {
                    try {
                      return renderAllResponses();
                    } catch (error) {
                      console.error('[ScholarExplorer] Content render error:', error);
                      return (
                        <div className="text-destructive p-4 border border-destructive rounded-md">
                          <h3 className="font-bold">Content Error</h3>
                          <p>{String(error)}</p>
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>
              {(() => {
                try {
                  return renderChatInputBar();
                } catch (error) {
                  console.error('[ScholarExplorer] Chat input bar render error:', error);
                  return <div className="text-destructive p-4">Input bar error: {String(error)}</div>;
                }
              })()}
            </div>
            {/* Removed sponsored advertisement */}
          </div>
        </div>
      </MainLayout>
    );
  } catch (error) {
    console.error('[ScholarExplorer] CRITICAL: Main render method failed:', error);
    setComponentError(error instanceof Error ? error : new Error(String(error)));

    // Fallback rendering when the main try/catch catches an error
    return (
      <MainLayout>
        <div className="h-full flex flex-col items-center justify-center p-8 bg-background text-foreground">
          <div className="max-w-lg border border-destructive/50 bg-destructive/10 rounded-lg p-6 text-center">
            <h2 className="text-xl font-bold mb-4">Rendering Error</h2>
            <p className="text-sm mb-4">
              {error instanceof Error ? error.message : String(error)}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-sm"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }
} 