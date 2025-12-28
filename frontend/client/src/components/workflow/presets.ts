import { Node, Edge, MarkerType } from '@xyflow/react';
import type { ToolNodeData } from './ToolNode';
import type { XYPosition } from '@xyflow/react';

// Helper to create a tool node
function createToolNode(
  id: string,
  label: string,
  toolType: ToolNodeData['toolType'],
  x: number,
  y: number
): Node<ToolNodeData> {
  return {
    id,
    type: 'toolNode',
    position: { x, y } as XYPosition,
    data: {
      id,
      label,
      toolType,
      config: {},
      status: 'pending',
      position: { x, y },
      data: {},
      onConfigChange: () => { },
      onRun: () => { },
    }
  };
}

// Basic Research: Source Finder -> AI Literature Review -> Export TXT
export function basicResearchWorkflow(): { nodes: Node<ToolNodeData>[]; edges: Edge[] } {
  const src = 'basic_src';
  const review = 'basic_review';
  const exp = 'basic_export';
  const nodes = [
    createToolNode(src, 'Source Finder', 'Source Finder', 50, 50),
    createToolNode(review, 'AI Literature Review', 'AI Literature Review', 450, 50),
    createToolNode(exp, 'Export TXT', 'Export TXT', 850, 50),
  ];
  const edges: Edge[] = [
    { id: 'e1', source: src, target: review, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: 'url(#blue-to-purple)', strokeWidth: 2, opacity: 0.8 } },
    { id: 'e2', source: review, target: exp, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: 'url(#blue-to-purple)', strokeWidth: 2, opacity: 0.8 } },
  ];
  return { nodes, edges };
}

// Fact Check: Source Finder -> Claim Extractor -> Contradiction Checker -> Export DOC
export function factCheckWorkflow(): { nodes: Node<ToolNodeData>[]; edges: Edge[] } {
  const src = 'fact_src';
  const claim = 'fact_claim';
  const contra = 'fact_contra';
  const exp = 'fact_export';
  const nodes = [
    createToolNode(src, 'Source Finder', 'Source Finder', 50, 150),
    createToolNode(claim, 'Claim Extractor', 'Claim Extractor', 450, 150),
    createToolNode(contra, 'Contradiction Checker', 'Contradiction Checker', 850, 150),
    createToolNode(exp, 'Export DOC', 'Export DOC', 1250, 150),
  ];
  const edges: Edge[] = [
    { id: 'e3', source: src, target: claim, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: 'url(#blue-to-purple)', strokeWidth: 2, opacity: 0.8 } },
    { id: 'e4', source: claim, target: contra, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: 'url(#blue-to-purple)', strokeWidth: 2, opacity: 0.8 } },
    { id: 'e5', source: contra, target: exp, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: 'url(#blue-to-purple)', strokeWidth: 2, opacity: 0.8 } },
  ];
  return { nodes, edges };
}

// Bibliography Creation: Source Finder -> Reference & Citation Management -> Export TXT
export function bibliographyWorkflow(): { nodes: Node<ToolNodeData>[]; edges: Edge[] } {
  const src = 'bib_src';
  const ref = 'bib_ref';
  const exp = 'bib_export';
  const nodes = [
    createToolNode(src, 'Source Finder', 'Source Finder', 50, 250),
    createToolNode(ref, 'Reference & Citation Management', 'Reference & Citation Management', 450, 250),
    createToolNode(exp, 'Export TXT', 'Export TXT', 850, 250),
  ];
  const edges: Edge[] = [
    { id: 'e6', source: src, target: ref, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: 'url(#blue-to-purple)', strokeWidth: 2, opacity: 0.8 } },
    { id: 'e7', source: ref, target: exp, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: 'url(#blue-to-purple)', strokeWidth: 2, opacity: 0.8 } },
  ];
  return { nodes, edges };
}

// Literature Review: Source Finder -> AI Literature Review -> Export DOC
export function literatureReviewWorkflow(): { nodes: Node<ToolNodeData>[]; edges: Edge[] } {
  const src = 'lit_src';
  const review = 'lit_review';
  const exp = 'lit_export';
  const nodes = [
    createToolNode(src, 'Source Finder', 'Source Finder', 50, 350),
    createToolNode(review, 'AI Literature Review', 'AI Literature Review', 450, 350),
    createToolNode(exp, 'Export DOC', 'Export DOC', 850, 350),
  ];
  const edges: Edge[] = [
    { id: 'e8', source: src, target: review, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: 'url(#blue-to-purple)', strokeWidth: 2, opacity: 0.8 } },
    { id: 'e9', source: review, target: exp, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: 'url(#blue-to-purple)', strokeWidth: 2, opacity: 0.8 } },
  ];
  return { nodes, edges };
} 