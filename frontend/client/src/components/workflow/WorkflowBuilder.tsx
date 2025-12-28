import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Connection,
  Node,
  Edge,
  MarkerType,
  NodeTypes,
  MiniMap,
  XYPosition,
  BackgroundVariant,
  OnSelectionChangeParams,
  NodeChange,
  EdgeChange,
  ReactFlowInstance,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ToolNode, { ToolNodeData, ToolConfig, ToolType, ToolNodeWrapper } from './ToolNode';
import WorkflowChatPanel from './WorkflowChatPanel';
import { Button } from '@/components/ui/button';
import { Play, Loader2, Save, FolderOpen, Trash2, MessageSquare, Menu, Square } from 'lucide-react';
import { Paper } from '@/types/paper';
import {
  basicResearchWorkflow,
  factCheckWorkflow,
  bibliographyWorkflow,
  literatureReviewWorkflow
} from './presets';



// Define available tools for chat panel and sidebar
const availableTools: ToolType[] = [
  'Source Finder',
  'AI Literature Review',
  'Reference & Citation Management',
  'Claim Extractor',
  'Contradiction Checker',
  'Export TXT',
  'Export DOC'
];



interface SidebarProps {
  onDragStart: (event: React.DragEvent, tool: ToolNodeData['toolType']) => void;
  onRunWorkflow: () => void;
  onStopWorkflow: () => void;
  onSaveWorkflow: () => void;
  onLoadWorkflow: () => void;
  onClearWorkflow: () => void;
  onApplyPreset: (preset: () => { nodes: Node<ToolNodeData>[], edges: Edge[] }) => void;
  runningWorkflow: boolean;
  availableTools: ToolType[];
  onToggleSidebar?: () => void;
  onToggleChat: () => void;
}

function Sidebar({
  onDragStart,
  onRunWorkflow,     // Explicitly destructure
  onStopWorkflow,    // Explicitly destructure
  onSaveWorkflow,    // Explicitly destructure
  onLoadWorkflow,    // Explicitly destructure
  onClearWorkflow,   // Explicitly destructure
  onApplyPreset,     // Explicitly destructure - FIX
  runningWorkflow,   // Explicitly destructure
  availableTools,
  onToggleSidebar,   // Explicitly destructure (if used, otherwise can be omitted if only passed through)
  onToggleChat       // Explicitly destructure (if used, otherwise can be omitted if only passed through)
}: SidebarProps) {
  // The availableTools prop is used directly for mapping, so no need for a local toolList

  return (
    <aside className="w-full h-full bg-white dark:bg-slate-800 p-4 pt-10 flex flex-col overflow-y-auto shadow-xl">
      {/* Agents section first */}
      <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-slate-200 font-inter">Agents</h3>
      <div className="space-y-3 flex-grow">
        {availableTools.map((tool) => (
          <div
            key={tool}
            onDragStart={(event) => onDragStart(event, tool)}
            draggable
            className="p-2.5 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 border border-gray-300 dark:border-slate-600 rounded-md cursor-grab text-sm text-gray-800 dark:text-slate-200 shadow-sm active:shadow-inner active:bg-gray-200 dark:active:bg-slate-500 transition-all duration-150 ease-in-out"
          >
            {tool}
          </div>
        ))}
      </div>

      {/* Presets section at the very bottom with margin-top:auto to push it down */}
      <div className="mt-auto pt-4 border-t border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-slate-200 font-inter">Presets</h3>
        <div className="space-y-3">
          <button className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-900 dark:hover:bg-blue-800 dark:text-blue-200 rounded-md text-sm w-full text-left font-medium" onClick={() => onApplyPreset(basicResearchWorkflow)}>Basic Research</button>
          <button className="px-3 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 dark:bg-indigo-900 dark:hover:bg-indigo-800 dark:text-indigo-200 rounded-md text-sm w-full text-left font-medium" onClick={() => onApplyPreset(factCheckWorkflow)}>Fact Check</button>
          <button className="px-3 py-2 bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-900 dark:hover:bg-purple-800 dark:text-purple-200 rounded-md text-sm w-full text-left font-medium" onClick={() => onApplyPreset(bibliographyWorkflow)}>Bibliography</button>
          <button className="px-3 py-2 bg-pink-100 hover:bg-pink-200 text-pink-800 dark:bg-pink-900 dark:hover:bg-pink-800 dark:text-pink-200 rounded-md text-sm w-full text-left font-medium" onClick={() => onApplyPreset(literatureReviewWorkflow)}>Literature Review</button>
        </div>
      </div>
    </aside>
  );
}

// To make this snippet runnable for testing, you might need a dummy export:
// export default Sidebar; // Or integrate back into your main WorkflowBuilder component.

const initialNodes: Node<ToolNodeData>[] = [];
const initialEdges: Edge[] = [];

const nodeTypes: NodeTypes = {
  toolNode: ToolNodeWrapper,
};

export default function WorkflowBuilder() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ToolNodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const { getViewport, screenToFlowPosition } = useReactFlow<Node<ToolNodeData>, Edge>();
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<Node<ToolNodeData>, Edge> | null>(null);
  const [runningWorkflow, setRunningWorkflow] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selection, setSelection] = useState<OnSelectionChangeParams>({ nodes: [], edges: [] });
  const [copyBuffer, setCopyBuffer] = useState<{ nodes: Node<ToolNodeData>[]; edges: Edge[] } | null>(null);
  const [lastAction, setLastAction] = useState<{ type: 'paste' | 'cut'; nodes: Node<ToolNodeData>[]; edges: Edge[] } | null>(null);
  const [redoAction, setRedoAction] = useState<typeof lastAction>(null);
  const [workflowExecutionRefs, setWorkflowExecutionRefs] = useState<number[]>([]);
  const idCounter = useRef(1);

  useEffect(() => { document.title = 'Workflow Builder'; }, []);
  useEffect(() => { nodesRef.current = nodes; edgesRef.current = edges; }, [nodes, edges]);

  // Delete with Delete key only - useEffect remains the same
  useEffect(() => {
    const handleDelete = (e: KeyboardEvent) => {
      if (e.key !== 'Delete') return;
      const active = document.activeElement;
      const isTyping = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement || (active instanceof HTMLElement && active.isContentEditable);
      if (isTyping) { e.stopPropagation(); return; }
      if (selection.nodes.length) {
        const ids = selection.nodes.map(n => n.id);
        setNodes(ns => ns.filter(n => !ids.includes(n.id)));
        setEdges(es => es.filter(e => !ids.includes(e.source as string) && !ids.includes(e.target as string)));
        setSelection({ nodes: [], edges: [] });
      }
    };
    window.addEventListener('keydown', handleDelete);
    return () => window.removeEventListener('keydown', handleDelete);
  }, [selection, setNodes, setEdges]);

  // Global keyboard shortcuts - useEffect remains the same
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      const target = e.target as Element;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);
      if (isTyping) return;
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;
      if (!ctrlKey) return;
      switch (e.key.toLowerCase()) {
        case 'c': if (selection.nodes.length) { e.preventDefault(); const ids = selection.nodes.map(n => n.id); setCopyBuffer({ nodes: nodes.filter(n => ids.includes(n.id)), edges: edges.filter(edge => ids.includes(edge.source as string) && ids.includes(edge.target as string)) }); } break;
        case 'x': if (selection.nodes.length) { e.preventDefault(); const ids = selection.nodes.map(n => n.id); const nodesToCut = nodes.filter(n => ids.includes(n.id)); const edgesToCut = edges.filter(edge => ids.includes(edge.source as string) && ids.includes(edge.target as string)); setCopyBuffer({ nodes: nodesToCut, edges: edgesToCut }); setLastAction({ type: 'cut', nodes: nodesToCut, edges: edgesToCut }); setNodes(ns => ns.filter(n => !ids.includes(n.id))); setEdges(es => es.filter(e2 => !ids.includes(e2.source as string) && !ids.includes(e2.target as string))); setSelection({ nodes: [], edges: [] }); } break;
        case 'v': if (copyBuffer) { e.preventDefault(); const oldToNew: Record<string, string> = {}; const newNodes = copyBuffer.nodes.map(n => { const newId = `${n.id}_${idCounter.current++}`; oldToNew[n.id] = newId; return { ...n, id: newId, dragHandle: '.drag-handle', data: { ...n.data, id: newId }, position: { x: n.position.x + 40, y: n.position.y + 40 } }; }); const newEdges = copyBuffer.edges.map(e2 => ({ ...e2, id: `e_${idCounter.current++}`, source: oldToNew[e2.source as string], target: oldToNew[e2.target as string] })); setNodes(ns => ns.concat(newNodes)); setEdges(es => es.concat(newEdges)); setLastAction({ type: 'paste', nodes: newNodes, edges: newEdges }); setSelection({ nodes: newNodes, edges: newEdges }); } break;
        case 'a': e.preventDefault(); setSelection({ nodes, edges }); break;
        case 'z': if (lastAction) { e.preventDefault(); if (lastAction.type === 'paste') { const ids = lastAction.nodes.map(n => n.id); setNodes(ns => ns.filter(n => !ids.includes(n.id))); setEdges(es => es.filter(e2 => !lastAction.edges.map(ed => ed.id).includes(e2.id))); } else if (lastAction.type === 'cut') { setNodes(ns => ns.concat(lastAction.nodes)); setEdges(es => es.concat(lastAction.edges)); } setRedoAction(lastAction); setLastAction(null); setSelection({ nodes: [], edges: [] }); } break;
        case 'y': if (redoAction) { e.preventDefault(); if (redoAction.type === 'paste') { setNodes(ns => ns.concat(redoAction.nodes)); setEdges(es => es.concat(redoAction.edges)); } else if (redoAction.type === 'cut') { const ids = redoAction.nodes.map(n => n.id); setNodes(ns => ns.filter(n => !ids.includes(n.id))); setEdges(es => es.filter(e2 => !redoAction.edges.map(ed => ed.id).includes(e2.id))); } setLastAction(redoAction); setRedoAction(null); } break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [copyBuffer, lastAction, redoAction, selection, nodes, edges, setNodes, setEdges]);


  const getInputFromPredecessorNode = useCallback((
    nodeId: string,
    currentEdges: Edge[], // Use direct refs from parent scope (nodesRef.current, etc.)
    currentNodes: Node<ToolNodeData>[],
    toolTypeForContext?: ToolType
  ): string | any[] | null => {
    const incomingEdge = currentEdges.find(e => e.target === nodeId);
    if (incomingEdge) {
      const predNode = currentNodes.find(n => n.id === incomingEdge.source);
      if (predNode?.data.output) {
        const output = predNode.data.output;
        const predToolType = predNode.data.toolType;

        if (toolTypeForContext === 'AI Literature Review' && output.papers && Array.isArray(output.papers)) {
          return output.papers;
        }

        if (output.papers && (predToolType === 'Source Finder' || !predToolType)) {
          return output.papers.map((p: any) =>
            `${p.title}. ${Array.isArray(p.authors) ? p.authors.join(', ') : ''} (${p.published || ''})`
          ).join('\n');
        }
        if (output.claims && Array.isArray(output.claims) && (predToolType === 'Claim Extractor' || predToolType === 'Contradiction Checker')) {
          return output.claims.map((c: any) => typeof c === 'string' ? c : (c.text || JSON.stringify(c))).join('\n---\n');
        }
        if (output.review && typeof output.review === 'string') { return output.review; }
        if (output.text && typeof output.text === 'string') { return output.text; }
        if (typeof output === 'string') { return output; }
        return JSON.stringify(output, null, 2);
      }
    }
    return null;
  }, []); // No dependencies as it uses passed-in args or refs' current values within the new handleToolExecution

  const fetchApiAndParse = useCallback(async (url: string, body: object, apiHeaders: any, toolTypeForLog: ToolType) => {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...apiHeaders },
      body: JSON.stringify(body)
    });
    const raw = await resp.text();
    console.log(`Raw response for ${toolTypeForLog}:`, raw);
    let json: any;
    try {
      json = raw ? JSON.parse(raw) : {};
    } catch (e: any) {
      throw new Error(`Invalid JSON response: ${e.message} -- raw: ${raw}`);
    }
    if (!resp.ok) throw new Error(json.error || resp.statusText || raw);
    return json;
  }, []);


  const handleToolExecution = useCallback(async (nodeId: string) => {
    const nodeToExecute = nodesRef.current.find(n => n.id === nodeId);
    if (!nodeToExecute) {
      console.error(`Node ${nodeId} not found for execution.`);
      setNodes(nds => nds.map(n_ => (n_.id === nodeId ? { ...n_, data: { ...n_.data, status: 'error', output: { error: "Node not found" } } } : n_)));
      return;
    }

    const { toolType, config } = nodeToExecute.data;
    const currentNodesSnapshot = nodesRef.current; // Snapshot for this execution run
    const currentEdgesSnapshot = edgesRef.current; // Snapshot for this execution run

    const existingSessionId = nodeToExecute.data.sessionId;
    const sessionId = existingSessionId || `tool_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (!existingSessionId) {
      setNodes(nds => nds.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, sessionId } } : n
      ));
    }

    try {
      const modelId = config.model || 'nineveh';
      const headers = { 'Content-Type': 'application/json' };

      // Credit check removed for self-hosted version

      let responseData: any;

      switch (toolType) {
        case 'Source Finder':
          responseData = await fetchApiAndParse('/api/source-finder/search', { query: config.prompt, model: config.model }, headers, toolType);
          break;
        case 'Claim Extractor': {
          const extractedInput = getInputFromPredecessorNode(nodeId, currentEdgesSnapshot, currentNodesSnapshot);
          const inputText = config.prompt || (typeof extractedInput === 'string' ? extractedInput : '');
          if (!inputText) throw new Error('Claim Extractor requires an input prompt or a connection providing text output.');
          responseData = await fetchApiAndParse('/api/claim-extractor/extract', { prompt: inputText, model: config.model }, headers, toolType);
          break;
        }
        case 'Contradiction Checker': {
          const extractedInput = getInputFromPredecessorNode(nodeId, currentEdgesSnapshot, currentNodesSnapshot);
          const inputText = config.prompt || (typeof extractedInput === 'string' ? extractedInput : '');
          if (!inputText) throw new Error('Contradiction Checker requires an input prompt or connection with text/claims output.');
          responseData = await fetchApiAndParse('/api/contradiction-check/check', { text: inputText, modelId: config.model }, headers, toolType);
          break;
        }
        case 'AI Literature Review': {
          let papersInput: any[] = [];
          const predecessorOutput = getInputFromPredecessorNode(nodeId, currentEdgesSnapshot, currentNodesSnapshot, 'AI Literature Review');
          if (predecessorOutput && Array.isArray(predecessorOutput)) papersInput = predecessorOutput;

          responseData = await fetchApiAndParse('/api/literature-review/generate', {
            reviewTopicScope: config.reviewTopicScope, reviewType: config.reviewType,
            reviewDepthLength: config.reviewDepthLength, reviewTone: config.reviewTone,
            yearFrom: config.yearFrom, yearTo: config.yearTo, papers: papersInput, model: config.model
          }, headers, toolType);
          break;
        }
        case 'Reference & Citation Management': {
          const referencesInputFromConfig = config.referencesInput || '';
          const extractedInput = getInputFromPredecessorNode(nodeId, currentEdgesSnapshot, currentNodesSnapshot);
          const inputStr = referencesInputFromConfig || (typeof extractedInput === 'string' ? extractedInput : '');
          if (!inputStr) console.warn("Reference tool has no input string from config or predecessor.");
          responseData = await fetchApiAndParse('/api/reference-management/format', {
            referencesInput: inputStr, citationStyle: config.citationStyle, model: config.model
          }, headers, toolType);
          break;
        }
        case 'Export TXT': {
          const exportContent = getInputFromPredecessorNode(nodeId, currentEdgesSnapshot, currentNodesSnapshot) || (config.prompt || '');
          const resp = await fetch('/api/export-tools/txt', {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ exportData: exportContent, exportFileName: config.exportFileName || 'export.txt' })
          });
          if (!resp.ok) throw new Error(await resp.text() || resp.statusText);
          const blob = await resp.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = config.exportFileName || 'export.txt'; document.body.appendChild(a);
          a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
          responseData = { message: 'File downloaded successfully', fileName: config.exportFileName || 'export.txt' };
          break;
        }
        case 'Export DOC': {
          const exportContent = getInputFromPredecessorNode(nodeId, currentEdgesSnapshot, currentNodesSnapshot) || (config.prompt || '');
          const resp = await fetch('/api/export-tools/doc', {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ content: exportContent, fileName: config.exportFileName || 'export.doc' })
          });
          if (!resp.ok) throw new Error(await resp.text() || resp.statusText);
          const docHtmlContent = await resp.text();
          responseData = { content: docHtmlContent, message: 'Export successful', fileName: config.exportFileName || 'export.doc' };
          break;
        }
        default:
          throw new Error(`Unknown or unhandled tool type: ${toolType}`);
      }

      // Credit deduction removed for self-hosted version

      setNodes(nds => nds.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, status: 'success', output: responseData, sessionId } } : n
      ));

    } catch (error: any) {
      console.error(`Error running node ${nodeId} (${toolType})`, error);
      setNodes(nds => nds.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, status: 'error', output: { error: error.message }, sessionId } } : n
      ));
    }
  }, [setNodes, getInputFromPredecessorNode, fetchApiAndParse]); // nodesRef, edgesRef are stable refs


  const createOnRunCallback = useCallback((nodeId: string) => {
    return async () => {
      setNodes(nds => nds.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, status: 'running' } } : n
      ));
      await new Promise(resolve => setTimeout(resolve, 0)); // Allow UI update
      await handleToolExecution(nodeId);
    };
  }, [handleToolExecution, setNodes]);


  const onConnect = useCallback((params: Connection | Edge) =>
    setEdges(eds => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: 'url(#blue-to-purple)', strokeWidth: 2, opacity: 0.8 } } as Edge, eds)),
    [setEdges]
  );
  const onDragStart = useCallback((evt: React.DragEvent, tool: ToolNodeData['toolType']) => { evt.dataTransfer.setData('application/reactflow', tool); evt.dataTransfer.effectAllowed = 'move'; }, []);
  const onDragOver = useCallback((evt: React.DragEvent) => { evt.preventDefault(); evt.dataTransfer.dropEffect = 'move'; }, []);
  const onInit = useCallback((instance: ReactFlowInstance<Node<ToolNodeData>, Edge>) => { setFlowInstance(instance); instance.setViewport({ x: 0, y: 0, zoom: 0.2 }); }, []);
  const onSelectionChangeHandler = useCallback(({ nodes: selNodes, edges: selEdges }: OnSelectionChangeParams) => setSelection({ nodes: selNodes, edges: selEdges }), []);
  const miniMap = useMemo(() => <MiniMap style={isChatOpen ? { right: 330, bottom: 10 } : { right: 10, bottom: 10 }} />, [isChatOpen]);


  const onDrop = useCallback((evt: React.DragEvent) => {
    evt.preventDefault();
    if (!reactFlowWrapper.current || !flowInstance) return;
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const tool = evt.dataTransfer.getData('application/reactflow') as ToolNodeData['toolType'];
    if (!tool) return;
    const pos = screenToFlowPosition({ x: evt.clientX - bounds.left, y: evt.clientY - bounds.top });
    const newId = `${tool.replace(/\s+/g, '')}_${idCounter.current++}`;
    const newNode: Node<ToolNodeData> = {
      id: newId, type: 'toolNode', dragHandle: '.drag-handle', position: pos,
      data: {
        id: newId, label: tool, toolType: tool, config: {}, status: 'pending', position: pos, data: {},
        onConfigChange: (id, newConfig) => {
          setNodes(nds => nds.map(n =>
            n.id === id ? { ...n, data: { ...n.data, config: { ...n.data.config, ...newConfig } } } : n
          ));
        },
        onRun: createOnRunCallback(newId) // Use the new callback creator
      }
    };
    setNodes(nds => nds.concat(newNode));
  }, [flowInstance, setNodes, screenToFlowPosition, createOnRunCallback]);


  const toggleChatPanel = () => setIsChatOpen(!isChatOpen);
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleChatWorkflowGenerated = (newNodesFromChat: Node<ToolNodeData>[], newEdges: Edge[], source?: string) => {
    console.log(`Workflow generated by ${source || 'chat'}:`, { newNodes: newNodesFromChat, newEdges });
    const CHAT_NODE_HORIZONTAL_SPACING = 350;
    const CHAT_NODE_VERTICAL_OFFSET = 150;
    const CHAT_NODE_DEFAULT_Y = 100;
    const CHAT_NODE_DEFAULT_X_START = 100;
    let baseY = CHAT_NODE_DEFAULT_Y;
    if (nodes.length > 0) {
      const typicalNodeHeight = 150;
      const yPositions = nodes.map(n => n.position?.y ?? 0);
      baseY = Math.max(...yPositions) + typicalNodeHeight + CHAT_NODE_VERTICAL_OFFSET;
    }
    const rewiredNewNodes = newNodesFromChat.map((node, index) => ({
      ...node, dragHandle: '.drag-handle',
      position: { x: CHAT_NODE_DEFAULT_X_START + index * CHAT_NODE_HORIZONTAL_SPACING, y: baseY },
      data: {
        ...node.data,
        id: node.id, // Ensure id is in data for ToolNode
        onConfigChange: (id: string, newConfig: ToolConfig) => {
          setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, config: newConfig } } : n));
        },
        onRun: createOnRunCallback(node.id) // Use the new callback creator
      }
    }));
    setNodes(currentNodes => [...currentNodes, ...rewiredNewNodes]);
    setEdges(currentEdges => [...currentEdges, ...newEdges]);
  };


  const onRunWorkflow = useCallback(() => {
    if (nodesRef.current.length === 0) { console.warn('No workflow to run'); return; }
    console.log('Running workflow with nodes:', nodesRef.current);
    setRunningWorkflow(true);
    setNodes(prevNodes => prevNodes.map(node => ({ ...node, data: { ...node.data, status: 'running' } })));
    const rootNodes = nodesRef.current.filter(node => !edgesRef.current.some(edge => edge.target === node.id));
    if (rootNodes.length === 0) { console.warn('No root nodes found in workflow'); setRunningWorkflow(false); return; }
    console.log('Starting workflow execution with root nodes:', rootNodes);
    const timeoutIdsStore: number[] = []; // Renamed to avoid conflict
    const executeNode = async (nodeId: string, delay: number): Promise<number> => { // Ensure it returns a number (timeoutId)
      const timeoutId = window.setTimeout(async () => {
        const node = nodesRef.current.find(n => n.id === nodeId);
        if (node && node.data.onRun) {
          try {
            console.log(`Executing node: ${nodeId}, current status: ${node.data.status}`);
            if (!node.data.sessionId) {
              const newSessionId = `workflow_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
              setNodes(nds => nds.map(n_1 => n_1.id === nodeId ? { ...n_1, data: { ...n_1.data, sessionId: newSessionId } } : n_1));
              await new Promise(resolve => setTimeout(resolve, 10));
            }
            await node.data.onRun(nodeId);
            console.log(`Node ${nodeId} finished execution.`);
          } catch (error) {
            console.error(`Error during onRun for node ${nodeId}:`, error);
          }
        }
        await new Promise(resolve => setTimeout(resolve, 0));
        const currentEdges = edgesRef.current;
        const currentNodes = nodesRef.current;
        const childEdges = currentEdges.filter(edge => edge.source === nodeId);
        const childNodesToExecute = childEdges.map(edge => currentNodes.find(n => n.id === edge.target)).filter(Boolean) as Node<ToolNodeData>[];
        console.log(`Child nodes for ${nodeId}:`, childNodesToExecute.map(cn => cn.id));
        if (childNodesToExecute.length > 0) {
          for (let i = 0; i < childNodesToExecute.length; i++) {
            const child = childNodesToExecute[i];
            const childNodeData = currentNodes.find(n => n.id === child.id);
            if (childNodeData && childNodeData.data.status === 'running') {
              console.log(`Queueing child node ${child.id} for execution.`);
              const newTimeoutId = await executeNode(child.id, 50);
              timeoutIdsStore.push(newTimeoutId);
            }
          }
        }
        const allNodesProcessed = nodesRef.current.every(n => n.data.status === 'success' || n.data.status === 'error');
        if (allNodesProcessed) {
          console.log('Workflow execution complete.');
          setRunningWorkflow(false);
          setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, status: n.data.status === 'running' ? 'pending' : n.data.status } })));
        } else {
          console.log(`Node ${nodeId} and its children processed. Checking other branches.`);
          const anyStillRunning = nodesRef.current.some(n => n.data.status === 'running');
          if (!anyStillRunning && !allNodesProcessed) {
            console.warn('Workflow appears stuck or partially complete.');
            setRunningWorkflow(false);
          }
        }
      }, delay);
      timeoutIdsStore.push(timeoutId); // This was outside, should be inside to store the current timeoutId
      return timeoutId;
    };
    rootNodes.forEach(async (node, index) => { // Added async here for await executeNode
      const tid = await executeNode(node.id, 500 + (index * 200)); // Capture and store
      timeoutIdsStore.push(tid);
    });
    setWorkflowExecutionRefs(timeoutIdsStore); // Set all collected timeout IDs
  }, [setNodes, setRunningWorkflow, setWorkflowExecutionRefs]);


  const onStopWorkflow = useCallback(() => {
    console.log('Stopping workflow execution');
    workflowExecutionRefs.forEach(timeoutId => window.clearTimeout(timeoutId));
    setWorkflowExecutionRefs([]);
    setNodes(prevNodes => prevNodes.map(node => ({ ...node, data: { ...node.data, status: 'pending' } })));
    setRunningWorkflow(false);
  }, [workflowExecutionRefs, setNodes]);

  const onSaveWorkflow = useCallback(() => {
    if (nodes.length === 0) {
      console.warn('No workflow to save');
      return;
    }

    // Prepare workflow data (strip out functions that can't be serialized)
    const workflowData = {
      nodes: nodes.map(node => ({
        ...node,
        data: {
          id: node.data.id,
          label: node.data.label,
          toolType: node.data.toolType,
          config: node.data.config,
          status: 'pending', // Reset status on save
        }
      })),
      edges: edges,
      savedAt: new Date().toISOString()
    };

    // Save to localStorage
    localStorage.setItem('plaintextai_workflow', JSON.stringify(workflowData));

    // Also offer file download
    const blob = new Blob([JSON.stringify(workflowData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('Workflow saved successfully');
  }, [nodes, edges]);

  const onLoadWorkflow = useCallback(() => {
    // Create a file input to load from file
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const workflowData = JSON.parse(event.target?.result as string);

          if (!workflowData.nodes || !workflowData.edges) {
            console.error('Invalid workflow file format');
            return;
          }

          // Rewire the nodes with proper callbacks
          const loadedNodes = workflowData.nodes.map((node: any) => ({
            ...node,
            dragHandle: '.drag-handle',
            data: {
              ...node.data,
              config: node.data.config || {},
              status: 'pending',
              onConfigChange: (id: string, newConfig: Partial<ToolConfig>) => {
                setNodes(nds => nds.map(n =>
                  n.id === id ? { ...n, data: { ...n.data, config: { ...n.data.config, ...newConfig } } } : n
                ));
              },
              onRun: createOnRunCallback(node.data.id || node.id)
            }
          }));

          setNodes(loadedNodes);
          setEdges(workflowData.edges);
          console.log('Workflow loaded successfully');
        } catch (error) {
          console.error('Error parsing workflow file:', error);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [setNodes, setEdges, createOnRunCallback]);

  const onClearWorkflow = useCallback(() => {
    if (runningWorkflow) onStopWorkflow();
    setNodes([]); setEdges([]);
  }, [setNodes, setEdges, runningWorkflow, onStopWorkflow]);


  const onApplyPreset = useCallback((preset: () => { nodes: Node<ToolNodeData>[], edges: Edge[] }) => {
    const { nodes: presetNodes, edges: presetEdges } = preset();
    const onConfigChangeHandler = (id: string, newConfig: Partial<ToolConfig>) => {
      setNodes(nds => nds.map(n =>
        n.id === id ? { ...n, data: { ...n.data, config: { ...n.data.config, ...newConfig } } } : n
      ));
    };

    const augmentedPresetNodes = presetNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        config: node.data.config || {},
        onConfigChange: onConfigChangeHandler,
        onRun: createOnRunCallback(node.id), // Use the new callback creator
        id: node.id
      }
    }));
    setNodes(augmentedPresetNodes);
    setEdges(presetEdges);
  }, [setNodes, setEdges, createOnRunCallback]); // nodesRef, edgesRef removed as direct deps, used via handleToolExecution's closure


  return (
    <div className="fixed inset-0 flex">
      {isSidebarOpen && (
        <div className="w-64 h-full flex-shrink-0 z-10">
          <Sidebar
            onDragStart={onDragStart} onRunWorkflow={onRunWorkflow} onStopWorkflow={onStopWorkflow}
            onSaveWorkflow={onSaveWorkflow} onLoadWorkflow={onLoadWorkflow} onClearWorkflow={onClearWorkflow}
            onApplyPreset={onApplyPreset} runningWorkflow={runningWorkflow} availableTools={availableTools}
            onToggleSidebar={toggleSidebar} onToggleChat={toggleChatPanel}
          />
        </div>
      )}
      <div className="flex-grow h-full relative" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={onConnect} onInit={onInit} onDrop={onDrop} onDragOver={onDragOver}
          onSelectionChange={onSelectionChangeHandler} nodeTypes={nodeTypes} deleteKeyCode="Delete"
          multiSelectionKeyCode="Control" fitView minZoom={0.1} maxZoom={2}
          className="bg-slate-100 dark:bg-slate-900" panOnDrag={true}
        >
          <svg style={{ position: 'absolute', width: 0, height: 0 }}>
            <defs>
              <linearGradient id="blue-to-purple" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(0, 102, 255, 0.8)" />
                <stop offset="100%" stopColor="rgba(162, 89, 255, 0.8)" />
              </linearGradient>
            </defs>
          </svg>
          <Controls />{miniMap}<Background />
        </ReactFlow>
        <div className="absolute top-20 left-4 z-20 flex gap-2">
          {!isSidebarOpen && (
            <Button onClick={toggleSidebar} size="icon" variant="secondary" className="rounded-full w-10 h-10 shadow-md">
              <Menu className="h-5 w-5" />
            </Button>
          )}
        </div>
        <div className={`absolute top-20 ${isChatOpen ? 'right-[calc(20rem+1rem)]' : 'right-4'} z-20 flex gap-2 transition-all duration-300`}>
          {runningWorkflow ? (
            <Button size="icon" onClick={onStopWorkflow} className="rounded-full w-10 h-10 bg-red-500 hover:bg-red-600 text-white shadow-md" title="Stop Workflow">
              <Square className="h-5 w-5" />
            </Button>
          ) : (
            <Button size="icon" onClick={onRunWorkflow} variant="gradient" className="rounded-full w-10 h-10 text-white shadow-md" title="Run Workflow">
              <Play className="h-5 w-5" />
            </Button>
          )}
          <Button size="icon" onClick={onSaveWorkflow} variant="secondary" className="rounded-full w-10 h-10 shadow-md" title="Save Workflow"><Save className="h-5 w-5" /></Button>
          <Button size="icon" onClick={onLoadWorkflow} variant="secondary" className="rounded-full w-10 h-10 shadow-md" title="Load Workflow"><FolderOpen className="h-5 w-5" /></Button>
          <Button size="icon" onClick={onClearWorkflow} variant="outline" className="rounded-full w-10 h-10 text-red-500 border-red-200 shadow-md" title="Clear Workflow"><Trash2 className="h-5 w-5" /></Button>
          <Button onClick={toggleChatPanel} size="icon" variant="secondary" className="rounded-full w-10 h-10 shadow-md" title="Toggle Chat"><MessageSquare className="h-5 w-5" /></Button>
        </div>
      </div>
      <WorkflowChatPanel
        isOpen={isChatOpen} onToggle={toggleChatPanel} onWorkflowGenerated={handleChatWorkflowGenerated}
        availableTools={availableTools} existingNodeCount={nodes.length}
      />
    </div>
  );
}