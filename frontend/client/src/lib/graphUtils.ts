import * as d3 from "d3";
import { Paper } from "@/types/paper";
import { SimulationNodeDatum } from "d3-force";

// Interface for the graph node data
export interface GraphNode extends SimulationNodeDatum {
  id: string | number;
  title: string;
  citations: number | undefined;
  selected: boolean;
  paper?: Paper; // Original paper object
  isSeed?: boolean; // Whether this is a seed/source node
}

// Interface for the graph link data
export interface GraphLink {
  source: string | number | GraphNode;
  target: string | number | GraphNode;
  value: number;
}

// Function to create the graph data from papers
export function createGraphData(
  papers: Paper[], 
  connectedPapers: Paper[], 
  selectedPaper: Paper | null
): { nodes: GraphNode[], links: GraphLink[] } {
  // Create nodes from papers
  const nodes: GraphNode[] = papers.map(paper => ({
    id: paper.arxiv_id,
    title: paper.title,
    citations: paper.citations,
    selected: selectedPaper ? paper.arxiv_id === selectedPaper.arxiv_id : false,
    paper, // Add the original paper object to the node
    isSeed: selectedPaper ? paper.arxiv_id === selectedPaper.arxiv_id : false // Mark selected paper as seed
  }));
  
  // Create links based on connected papers
  const links: GraphLink[] = [];
  
  // Create a map of node IDs for quick lookup
  const nodeMap = new Map<string | number, GraphNode>();
  nodes.forEach(node => nodeMap.set(node.id, node));
  
  if (selectedPaper) {
    connectedPapers.forEach(connectedPaper => {
      // Verify both source and target nodes exist before creating a link
      if (nodeMap.has(selectedPaper.arxiv_id) && nodeMap.has(connectedPaper.arxiv_id)) {
        // Add a link from selected paper to connected paper
        links.push({
          source: selectedPaper.arxiv_id,
          target: connectedPaper.arxiv_id,
          value: 1 // Base value, can be adjusted based on connection strength
        });
      }
      
      // Find connections between connected papers (optional)
      // This would create additional links between papers that are not directly 
      // connected to the selected paper but may be connected to each other
    });
  } else {
    // If no paper is selected, create a simple force-directed graph
    // This could be a default state or based on similarity measures
    papers.forEach((paper, i) => {
      // Just create a few links to make the graph connected
      // In a real app, this would be based on actual relationships
      const numLinks = Math.min(3, papers.length - 1);
      for (let j = 0; j < numLinks; j++) {
        const targetIndex = (i + j + 1) % papers.length;
        if (targetIndex !== i) {
          const sourceId = paper.arxiv_id;
          const targetId = papers[targetIndex].arxiv_id;
          
          // Verify both source and target nodes exist before creating a link
          if (nodeMap.has(sourceId) && nodeMap.has(targetId)) {
            links.push({
              source: sourceId,
              target: targetId,
              value: 0.5 // Default link strength
            });
          }
        }
      }
    });
  }
  
  return { nodes, links };
}

// Build D3 force simulation
export function buildSimulationForces(
  nodes: GraphNode[], 
  links: GraphLink[], 
  width: number, 
  height: number
): d3.Simulation<GraphNode, GraphLink> {
  return d3.forceSimulation<GraphNode>(nodes)
    .force("link", d3.forceLink<GraphNode, GraphLink>(links)
      .id(d => d.id.toString())
      .distance(100))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius((d: any) => {
      return calculateNodeRadius(d.citations || 0) + 10;
    }));
}

// Calculate node radius based on citations
export function calculateNodeRadius(citations: number): number {
  return Math.max(5, Math.min(15, 5 + Math.log(citations + 1)));
}
