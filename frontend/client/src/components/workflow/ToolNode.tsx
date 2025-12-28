import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Copy, Check } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

// CSS to disable default textarea resize handle
// const noResizeTextareaClass = 'no-resize-textarea'; // Removed
const styles = `
  .line-clamp-5 {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 5;
    overflow: hidden;
    text-overflow: ellipsis;
    max-height: calc(5 * 1.5em); /* Assuming 1.5em line height, adjust as needed */
    white-space: normal; /* Ensure text wraps */
  }
  .tool-node {
    transform-origin: center;
    transform: scale(0.8); /* Make node widgets even smaller */
  }
`;

// Define a type for the config object to ensure keys are always present for keyof
export type ToolConfig = {
  prompt?: string;
  prompt2?: string;
  model?: string;
  numSources?: number;  // Source Finder: number of sources to retrieve
  yearFrom?: string;    // Source Finder: start year filter, AI Lit Review: start year
  yearTo?: string;      // Source Finder: end year filter, AI Lit Review: end year
  reviewTopicScope?: string; // AI Lit Review: Topic & Scope
  reviewType?: string;       // AI Lit Review: Type of review
  reviewDepthLength?: string; // AI Lit Review: Depth/Length of review
  reviewTone?: string;        // AI Lit Review: Tone of review
  referencesInput?: string;  // Reference Management: Input for references
  citationStyle?: string;    // Reference Management: Citation style (APA, MLA, etc.)
  exportFileName?: string;   // Export Tools: Suggested filename

  // Added for specific tool needs based on linter errors
  query?: string;                     // Source Finder: main search query
  searchMode?: 'semanticScholar' | 'vectorSearch'; // Source Finder: search backend
  limit?: number;                     // Source Finder: number of results (replaces numSources for clarity)
  minCitations?: number;              // Source Finder: filter by minimum citations
  modelId?: string;                   // General AI Tools: specific model identifier for backend (e.g., 'nineveh', 'alexandria')
  customReviewText?: string;          // AI Literature Review: if not using connected papers
  reviewPrompt?: string;              // AI Literature Review: the prompt for the review
  format?: string;                    // Reference & Citation Management: e.g. 'APA', 'MLA'
  textInput?: string;                 // Generic passthrough input
  dataInput?: any;                    // Generic passthrough input
};

export type ToolType =
  | 'Source Finder'
  | 'Contradiction Checker'
  | 'Data Analysis'
  | 'Claim Extractor'
  | 'AI Literature Review'
  | 'Reference & Citation Management'
  | 'Export TXT'
  | 'Export DOC';

export interface ToolNodeData extends Record<string, unknown> {
  label: string;
  toolType: ToolType;
  config: ToolConfig;
  status?: 'pending' | 'running' | 'success' | 'error';
  output?: any;
  onConfigChange?: (id: string, newConfig: Partial<ToolConfig>) => void;
  onRun?: (id: string) => void;
  id: string;
  sessionId?: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  width?: number;
  height?: number;
  sourcePosition?: Position;
  targetPosition?: Position;
  dragHandle?: string;
  parentId?: string;
}

const ToolNode: React.FC<NodeProps<ToolNodeData>> = ({ data, id, selected, sourcePosition, targetPosition, width, height, dragHandle, parentId }) => {
  // Ensure config is always an object, even if parent passes undefined somehow, though it shouldn't with new types
  const typedData = data as unknown as ToolNodeData;
  const { label, toolType, config = { prompt: '', prompt2: '', model: '' }, status = 'pending', output, onConfigChange } = typedData;
  const [copyState, setCopyState] = React.useState<{ [key: string]: boolean }>({});

  // Memoize the handler to prevent recreating it on each render
  const handleConfigFieldChange = React.useCallback((fieldName: keyof ToolConfig, value: string | number) => {
    if (onConfigChange) {
      onConfigChange(id, {
        ...config,
        [fieldName]: value
      });
    }
  }, [onConfigChange, id, config]);

  const handleRunButtonClick = React.useCallback(() => {
    if (typedData.onRun) {
      typedData.onRun(id);
    }
  }, [typedData.onRun, id]);

  const handleCopyToClipboard = React.useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyState({ ...copyState, [field]: true });
      toast({
        title: "Copied to clipboard",
        description: "The content has been copied to your clipboard.",
        duration: 2000,
      });
      setTimeout(() => {
        setCopyState({ ...copyState, [field]: false });
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard.",
        variant: "destructive",
        duration: 2000,
      });
    });
  }, [copyState]);

  const getOutputText = (output: any) => {
    if (typeof output === 'string') return output;
    if (output?.review) return output.review;
    if (output?.formattedReferences) return output.formattedReferences;
    if (output?.claims) return JSON.stringify(output.claims, null, 2);
    if (output?.papers) return JSON.stringify(output.papers, null, 2);
    return JSON.stringify(output, null, 2);
  };

  const modelOptions = [
    { value: 'gpt-5-mini', label: 'gpt-5 mini (Fast, Default)' },
    { value: 'gpt-5.2', label: 'gpt-5.2 (Advanced)' },
    // Add other relevant models accessible via API
  ];

  return (
    <Card
      className={`shadow-md ${selected ? 'ring-2 ring-primary/70 ring-offset-2 ring-offset-theme-background' : 'border-slate-200 dark:border-slate-700'} flex flex-col tool-node`}
      style={{
        position: 'relative',
        minWidth: 288,
        resize: 'both', // Allow resizing
        overflow: 'auto'  // Show scrollbars if content overflows during/after resize
      }}
    >
      {/* Target Handle Wrapper */}
      <div
        style={{
          position: 'absolute',
          left: '-12px', // Adjust to center the 24px wide area around the node's edge
          top: '50%',
          transform: 'translateY(-50%)',
          width: '24px', // Width of the clickable area
          height: '40px', // Height of the clickable area
          zIndex: 10, // Ensure it's above other elements if needed
          pointerEvents: 'none', // Allow clicks through wrapper
        }}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="!bg-gradient-to-r !from-primary/80 !to-accent/80 !w-3 !h-3 !shadow-md" // Gradient dot
          style={{
            pointerEvents: 'all', // Handle itself should be clickable
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)', // Center the dot within the wrapper
          }}
        />
      </div>

      <CardHeader className="drag-handle py-2 px-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 rounded-t-lg">
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm font-semibold text-theme-foreground">{label}</CardTitle>
          {status && (
            <Badge
              variant={
                status === 'success' ? 'default' :
                  status === 'error' ? 'destructive' :
                    status === 'running' ? 'outline' :
                      'secondary' // 'pending' state
              }
              className={
                status === 'running' ? 'animate-pulse' : ''
              }
            >
              {status === 'success' ? 'Completed' :
                status === 'error' ? 'Error' :
                  status === 'running' ? 'Running...' :
                    'Ready'
              }
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent
        className="p-3 text-xs space-y-2 flex-grow overflow-y-auto bg-white dark:bg-slate-900"
      >
        {toolType === 'Source Finder' && (
          <div className="space-y-2">
            <Textarea
              placeholder="Enter keywords or research question..."
              value={config.prompt || ''}
              onChange={(e) => handleConfigFieldChange('prompt', e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className={`nodrag text-xs line-clamp-5 block w-full`}
            />
            <div className="flex space-x-2">
              <div className="flex-1">
                <label className="text-xs">Sources</label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={config.numSources ?? 5}
                  onChange={(e) => handleConfigFieldChange('numSources', Number(e.target.value))}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="nodrag text-xs w-full"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs">Year From</label>
                <Input
                  type="number"
                  min={1900}
                  max={new Date().getFullYear()}
                  value={config.yearFrom || ''}
                  onChange={(e) => handleConfigFieldChange('yearFrom', e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="nodrag text-xs w-full"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs">Year To</label>
                <Input
                  type="number"
                  min={1900}
                  max={new Date().getFullYear()}
                  value={config.yearTo || ''}
                  onChange={(e) => handleConfigFieldChange('yearTo', e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="nodrag text-xs w-full"
                />
              </div>
            </div>
            {output?.papers && output.papers.length > 0 && (
              <div className="mt-2 border border-theme-border rounded p-2 bg-theme-muted/10 text-xs line-clamp-5">
                <div className="font-medium mb-1">Found {output.papers.length} papers:</div>
                <ul className="list-disc pl-4 max-h-24 overflow-y-auto space-y-1">
                  {output.papers.slice(0, 3).map((paper: any, index: number) => (
                    <li key={index} className="text-xs">
                      <span className="font-medium">{paper.title}</span>
                      {paper.authors && paper.authors.length > 0 && (
                        <span className="text-theme-muted-foreground"> - {paper.authors[0]}{paper.authors.length > 1 ? " et al." : ""}</span>
                      )}
                    </li>
                  ))}
                  {output.papers.length > 3 && (
                    <li className="text-theme-muted-foreground">...and {output.papers.length - 3} more papers</li>
                  )}
                </ul>
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              className="mt-1 w-full text-xs"
              onClick={handleRunButtonClick}
              disabled={!config.prompt || status === 'running'}
            >
              {status === 'running' ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Searching...
                </>
              ) : "Find Sources"}
            </Button>
          </div>
        )}
        {toolType === 'Claim Extractor' && (
          <>
            <div className="mb-2">
              {typedData.output?.fromPreviousNode && (
                <div className="mb-2 p-2 border border-theme-border/50 rounded bg-theme-muted/5 text-xs">
                  <p className="font-medium text-xs mb-1">Received input from previous node:</p>
                  <p className="text-theme-muted-foreground truncate">
                    {typeof typedData.output.fromPreviousNode === 'string'
                      ? typedData.output.fromPreviousNode.substring(0, 100) + (typedData.output.fromPreviousNode.length > 100 ? '...' : '')
                      : 'Connected data available'
                    }
                  </p>
                </div>
              )}
            </div>
            <Textarea
              placeholder="Enter text to extract claims from..."
              value={config.prompt || ''}
              onChange={(e) => handleConfigFieldChange('prompt', e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className={`nodrag text-xs line-clamp-5 block w-full h-28`}
            />
            <Select value={config.model || 'gpt-5-mini'} onValueChange={(val) => handleConfigFieldChange('model', val)}>
              <SelectTrigger className="nodrag text-xs mt-1">
                <SelectValue placeholder="Select Model" />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>

            {output?.claims && (
              <div className="mt-2 border border-theme-border rounded p-2 bg-theme-muted/10 text-xs line-clamp-5">
                <div className="font-medium mb-1">Extracted Claims:</div>
                <ul className="list-disc pl-4 max-h-24 overflow-y-auto space-y-1">
                  {output.claims.map((claim: any, idx: number) => (
                    <li key={idx} className="text-xs">
                      {claim.text || claim}
                    </li>
                  ))}
                </ul>
                <div className="mt-1 text-theme-muted-foreground text-xs">
                  {output.claims.length} claims extracted
                </div>
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              className="mt-2 w-full text-xs"
              onClick={handleRunButtonClick}
              disabled={(!config.prompt && !typedData.output?.fromPreviousNode) || status === 'running'}
            >
              {status === 'running' ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Extracting...
                </>
              ) : "Extract Claims"}
            </Button>
          </>
        )}
        {toolType === 'Contradiction Checker' && (
          <>
            {typedData.output?.fromPreviousNode && (
              <div className="mb-2 p-2 border border-theme-border/50 rounded bg-theme-muted/5 text-xs">
                <p className="font-medium text-xs mb-1">Received input from previous node:</p>
                <p className="text-theme-muted-foreground truncate">
                  {typeof typedData.output.fromPreviousNode === 'string'
                    ? typedData.output.fromPreviousNode.substring(0, 100) + (typedData.output.fromPreviousNode.length > 100 ? '...' : '')
                    : 'Connected data available'
                  }
                </p>
              </div>
            )}
            <label className="text-xs mb-1 block">Claims to Check (one per line or paragraph)</label>
            <Textarea
              placeholder="Enter claims or text to check for contradictions (separate multiple claims with new lines)"
              value={config.prompt || ''}
              onChange={(e) => handleConfigFieldChange('prompt', e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className={`nodrag text-xs line-clamp-5 block w-full h-40`}
            />
            <Select value={config.model || 'gpt-5-mini'} onValueChange={(val) => handleConfigFieldChange('model', val)}>
              <SelectTrigger className="nodrag text-xs mt-1">
                <SelectValue placeholder="Select Model for Analysis" />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>

            {output?.claims && (
              <div className="mt-2 border border-theme-border rounded p-2 bg-theme-muted/10 text-xs line-clamp-5">
                <div className="font-medium mb-1">Analysis Results:</div>
                <div className="overflow-y-auto max-h-24 space-y-1">
                  {output.claims.map((claim: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-1">
                      <Badge variant={claim.contradicted ? "destructive" : "outline"} className="mt-0.5 shrink-0">
                        {claim.contradicted ? "Contradicted" : "Consistent"}
                      </Badge>
                      <span className="text-xs text-theme-foreground">{claim.text.substring(0, 100)}{claim.text.length > 100 ? "..." : ""}</span>
                    </div>
                  ))}
                  {output.summary && (
                    <div className="mt-2 text-theme-muted-foreground">
                      Summary: {output.summary}
                    </div>
                  )}
                </div>
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              className="mt-2 w-full text-xs"
              onClick={handleRunButtonClick}
              disabled={(!config.prompt && !typedData.output?.fromPreviousNode) || status === 'running'}
            >
              {status === 'running' ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Analyzing...
                </>
              ) : "Check Contradictions"}
            </Button>
          </>
        )}
        {toolType === 'Data Analysis' && (
          <>
            <Textarea
              placeholder="Describe the data and analysis required..."
              value={config.prompt || ''}
              onChange={(e) => handleConfigFieldChange('prompt', e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className={`nodrag text-xs line-clamp-5 block w-full h-28`}
            />
            <Select value={config.model || 'gpt-5-mini'} onValueChange={(val) => handleConfigFieldChange('model', val)}>
              <SelectTrigger className="nodrag text-xs mt-1">
                <SelectValue placeholder="Select Model" />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>

            {output?.insights && (
              <div className="mt-2 border border-theme-border rounded p-2 bg-theme-muted/10 text-xs line-clamp-5">
                <div className="font-medium mb-1">Analysis Insights:</div>
                <div className="overflow-y-auto max-h-24 space-y-1">
                  {output.insights.map((insight: any, idx: number) => (
                    <div key={idx} className="text-xs flex items-start gap-1">
                      <Badge variant="outline" className="shrink-0">
                        {insight.type}
                      </Badge>
                      <span>{insight.description}</span>
                    </div>
                  ))}
                  {output.summary && (
                    <div className="mt-2 text-theme-muted-foreground">
                      {output.summary}
                    </div>
                  )}
                </div>
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              className="mt-2 w-full text-xs"
              onClick={handleRunButtonClick}
              disabled={!config.prompt || status === 'running'}
            >
              {status === 'running' ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Analyzing...
                </>
              ) : "Analyze Data"}
            </Button>
          </>
        )}
        {toolType === 'AI Literature Review' && (
          <div className="space-y-2">
            <label className="text-xs">Topic & Scope</label>
            <Textarea
              placeholder="Define the main topic, research questions, and scope..."
              value={config.reviewTopicScope || ''}
              onChange={(e) => handleConfigFieldChange('reviewTopicScope', e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className={`nodrag text-xs line-clamp-5 block w-full h-28`}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs">Review Type</label>
                <Select value={config.reviewType || ''} onValueChange={(val) => handleConfigFieldChange('reviewType', val)}>
                  <SelectTrigger className="nodrag text-xs w-full"><SelectValue placeholder="Select Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="narrative">Narrative Review</SelectItem>
                    <SelectItem value="systematic">Systematic Review</SelectItem>
                    <SelectItem value="meta-analysis">Meta-Analysis</SelectItem>
                    <SelectItem value="scoping">Scoping Review</SelectItem>
                    <SelectItem value="critical">Critical Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs">Depth/Length</label>
                <Select value={config.reviewDepthLength || ''} onValueChange={(val) => handleConfigFieldChange('reviewDepthLength', val)}>
                  <SelectTrigger className="nodrag text-xs w-full"><SelectValue placeholder="Select Depth" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brief">Brief Overview</SelectItem>
                    <SelectItem value="standard">Standard Report</SelectItem>
                    <SelectItem value="comprehensive">Comprehensive Analysis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs">Year From</label>
                <Input
                  type="number"
                  placeholder="YYYY"
                  value={config.yearFrom || ''}
                  onChange={(e) => handleConfigFieldChange('yearFrom', e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="nodrag text-xs w-full"
                />
              </div>
              <div>
                <label className="text-xs">Year To</label>
                <Input
                  type="number"
                  placeholder="YYYY"
                  value={config.yearTo || ''}
                  onChange={(e) => handleConfigFieldChange('yearTo', e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="nodrag text-xs w-full"
                />
              </div>
            </div>
            <div>
              <label className="text-xs">Tone</label>
              <Select value={config.reviewTone || ''} onValueChange={(val) => handleConfigFieldChange('reviewTone', val)}>
                <SelectTrigger className="nodrag text-xs w-full"><SelectValue placeholder="Select Tone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="academic">Academic</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs">Model</label>
              <Select value={config.model || 'gpt-5-mini'} onValueChange={(val) => handleConfigFieldChange('model', val)}>
                <SelectTrigger className="nodrag text-xs w-full"><SelectValue placeholder="Select Model" /></SelectTrigger>
                <SelectContent>
                  {modelOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {output?.review && (
              <div className="mt-2 border border-theme-border rounded p-2 bg-theme-muted/10 text-xs line-clamp-5">
                <div className="font-medium mb-1">Preview:</div>
                <div className="whitespace-pre-wrap max-h-24 overflow-y-auto">
                  {output.review.substring(0, 200)}
                  {output.review.length > 200 ? "..." : ""}
                </div>
                {output.papers && output.papers.length > 0 && (
                  <div className="mt-1 text-theme-muted-foreground">
                    Based on {output.papers.length} papers
                  </div>
                )}
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              className="mt-1 w-full text-xs"
              onClick={handleRunButtonClick}
              disabled={!config.reviewTopicScope || !config.reviewType || status === 'running'}
            >
              {status === 'running' ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Generating...
                </>
              ) : "Generate Literature Review"}
            </Button>
          </div>
        )}
        {toolType === 'Reference & Citation Management' && (
          <div className="space-y-2">
            <label className="text-xs">References / Bibliography</label>
            <Textarea
              placeholder="Paste your references here, one per line or as a bibliography..."
              value={config.referencesInput || ''}
              onChange={(e) => handleConfigFieldChange('referencesInput', e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className={`nodrag text-xs h-32 line-clamp-5`}
            />
            <div>
              <label className="text-xs">Citation Style</label>
              <Select value={config.citationStyle || ''} onValueChange={(val) => handleConfigFieldChange('citationStyle', val)}>
                <SelectTrigger className="nodrag text-xs w-full"><SelectValue placeholder="Select Style" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="apa">APA</SelectItem>
                  <SelectItem value="mla">MLA</SelectItem>
                  <SelectItem value="chicago">Chicago</SelectItem>
                  <SelectItem value="harvard">Harvard</SelectItem>
                  <SelectItem value="vancouver">Vancouver</SelectItem>
                  <SelectItem value="ieee">IEEE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {output?.formattedReferences && (
              <div className="mt-2 border border-theme-border rounded p-2 bg-theme-muted/10 text-xs line-clamp-5">
                <div className="font-medium mb-1">Formatted Preview:</div>
                <div className="whitespace-pre-wrap max-h-24 overflow-y-auto">
                  {output.formattedReferences.substring(0, 200)}
                  {output.formattedReferences.length > 200 ? "..." : ""}
                </div>
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              className="mt-1 w-full text-xs"
              onClick={handleRunButtonClick}
              disabled={!config.referencesInput || !config.citationStyle || status === 'running'}
            >
              {status === 'running' ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Processing...
                </>
              ) : "Process References"}
            </Button>
          </div>
        )}
        {toolType === 'Export TXT' && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Filename (Optional)</label>
            <Input
              type="text"
              placeholder="export.txt"
              value={config.exportFileName || ''}
              onChange={(e) => handleConfigFieldChange('exportFileName', e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="nodrag text-xs w-full border-slate-200 dark:border-slate-700 focus:border-primary/50 focus:ring-primary/50"
            />
            <Button
              size="sm"
              variant="gradient"
              className="mt-1 w-full text-xs shadow-sm"
              onClick={handleRunButtonClick}
              disabled={status === 'running'}
            >
              {status === 'running' ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Exporting...
                </>
              ) : "Export as TXT"}
            </Button>
          </div>
        )}
        {toolType === 'Export DOC' && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Filename (Optional)</label>
            <Input
              type="text"
              placeholder="export.doc"
              value={config.exportFileName || ''}
              onChange={(e) => handleConfigFieldChange('exportFileName', e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="nodrag text-xs w-full border-slate-200 dark:border-slate-700 focus:border-primary/50 focus:ring-primary/50"
            />
            <Button
              size="sm"
              variant="gradient"
              className="mt-1 w-full text-xs shadow-sm"
              onClick={handleRunButtonClick}
              disabled={status === 'running'}
            >
              {status === 'running' ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Exporting...
                </>
              ) : "Export as DOC"}
            </Button>
          </div>
        )}
        {output && (
          <div className="mt-2 p-2 bg-theme-muted/20 rounded border border-theme-border/50 max-h-24 overflow-y-auto text-theme-muted-foreground line-clamp-5 relative">
            <div className="flex justify-between items-start mb-1">
              <p className="font-semibold text-theme-foreground">Output Preview:</p>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 p-0.5 absolute top-1 right-1"
                onClick={() => handleCopyToClipboard(getOutputText(output), 'output')}
                title="Copy to clipboard"
              >
                {copyState['output'] ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <pre className="text-xs whitespace-pre-wrap break-all pt-2">
              {typeof output === 'string' ? output.substring(0, 100) + (output.length > 100 ? '...' : '') :
                JSON.stringify(output, null, 2).substring(0, 100) + (JSON.stringify(output, null, 2).length > 100 ? '...' : '')}
            </pre>
          </div>
        )}
      </CardContent>
      <CardFooter className="py-2 px-3 border-t border-slate-200 dark:border-slate-700 rounded-b-lg flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
        <Badge variant={status === 'success' ? 'default' : status === 'error' ? 'destructive' : 'secondary'} className="text-xs">
          {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Pending'}
        </Badge>
        {/* Add any other footer content if needed */}
      </CardFooter>

      {/* Source Handle Wrapper */}
      <div
        style={{
          position: 'absolute',
          right: '-12px', // Adjust to center the 24px wide area around the node's edge
          top: '50%',
          transform: 'translateY(-50%)',
          width: '24px', // Width of the clickable area
          height: '40px', // Height of the clickable area
          zIndex: 10,
          pointerEvents: 'none', // Allow clicks through wrapper
        }}
      >
        <Handle
          type="source"
          position={Position.Right}
          className="!bg-gradient-to-r !from-primary/80 !to-accent/80 !w-3 !h-3 !shadow-md" // Gradient dot
          style={{
            pointerEvents: 'all', // Handle itself should be clickable
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)', // Center the dot within the wrapper
          }}
        />
      </div>
      <style>{styles}</style>
    </Card>
  );
};

const ToolNodeWrapper: React.FC<NodeProps<ToolNodeData>> = (props) => {
  return (
    <>
      <style>{styles}</style>
      <ToolNode {...props} />
    </>
  );
};

// Properly memoize both components to avoid unnecessary re-renders
const MemoizedToolNode = memo(ToolNode);
const MemoizedToolNodeWrapper = memo(ToolNodeWrapper);

export { MemoizedToolNodeWrapper as ToolNodeWrapper };
export default MemoizedToolNodeWrapper;
