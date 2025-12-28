import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Paper } from '../types/paper';
import { GraphData, GraphNode, GraphLink } from '../lib/api';
import { CircularProgress, Box, Typography } from '@mui/material';

// --- Configuration ---
const DEFAULT_ZOOM_SCALE = 10;
const SELECTED_ZOOM_SCALE = 2.5;
const MIN_ZOOM_SCALE = 0.1;
const MAX_ZOOM_SCALE = 12;

interface GraphVisualizationProps {
    graphData?: GraphData;
    isLoading: boolean;
    selectedPaper: Paper | null;
    onNodeClick: (node: GraphNode) => void;
}

const GraphVisualization: React.FC<GraphVisualizationProps> = ({
    graphData,
    isLoading,
    selectedPaper,
    onNodeClick
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    const mainGroupRef = useRef<SVGGElement | null>(null);
    const initialZoomAppliedByEnd = useRef(false);
    const currentNodesRef = useRef<GraphNode[]>([]);
    const currentLinksRef = useRef<GraphLink[]>([]);


    // --- Effect for observing container size ---
    useEffect(() => {
        const resizeObserver = new ResizeObserver(entries => {
            if (entries[0]) {
                const { width, height } = entries[0].contentRect;
                if (width > 0 && height > 0) {
                    setDimensions(prevDimensions => {
                        if (prevDimensions.width !== width || prevDimensions.height !== height) {
                            return { width, height };
                        }
                        return prevDimensions;
                    });
                }
            }
        });
        let currentContainer: HTMLDivElement | null = null;
        if (containerRef.current) {
            currentContainer = containerRef.current;
            const { width, height } = currentContainer.getBoundingClientRect();
            if (width > 0 && height > 0) setDimensions({ width, height });
            else console.warn("GraphVisualization container initial dimensions zero.");
            resizeObserver.observe(currentContainer);
        }
        return () => {
            if (currentContainer) resizeObserver.unobserve(currentContainer);
            resizeObserver.disconnect();
        }
    }, []);

    // --- Memoized Function to Calculate Target Transform ---
    const calculateTargetTransform = useCallback((): d3.ZoomTransform => {
        if (!zoomRef.current || dimensions.width === 0 || dimensions.height === 0) {
            return d3.zoomIdentity;
        }
        const simNodes = simulationRef.current?.nodes();
        const nodesToUse = simNodes && simNodes.length > 0 ? simNodes : currentNodesRef.current;
        let scale = DEFAULT_ZOOM_SCALE;
        let x = dimensions.width / 2;
        let y = dimensions.height / 2;

        if (selectedPaper) {
            const selectedNode = nodesToUse.find(n => n.id === selectedPaper.arxiv_id);
            if (selectedNode && typeof selectedNode.x === 'number' && typeof selectedNode.y === 'number') {
                scale = SELECTED_ZOOM_SCALE;
            } else {
                scale = DEFAULT_ZOOM_SCALE;
            }
        } else {
            scale = DEFAULT_ZOOM_SCALE;
        }

        const scaleExtent = zoomRef.current.scaleExtent();
        const clampedScale = Math.max(scaleExtent[0], Math.min(scaleExtent[1], scale));

        if (selectedPaper) {
            const selectedNode = nodesToUse.find(n => n.id === selectedPaper.arxiv_id);
            if (selectedNode && typeof selectedNode.x === 'number' && typeof selectedNode.y === 'number') {
                x = dimensions.width / 2 - selectedNode.x * clampedScale;
                y = dimensions.height / 2 - selectedNode.y * clampedScale;
            } else {
                // When no position is available, center at origin
                x = dimensions.width / 2;
                y = dimensions.height / 2;
            }
        } else {
            // Center the visualization when no selection
            x = dimensions.width / 2;
            y = dimensions.height / 2;
        }
        return d3.zoomIdentity.translate(x, y).scale(clampedScale);
    }, [dimensions, selectedPaper, graphData]); // graphData proxy for currentNodesRef


    // --- Memoized Function to Apply Animated Zoom ---
    const applyAnimatedZoom = useCallback((targetTransform: d3.ZoomTransform) => {
        if (!svgRef.current || !zoomRef.current) return;
        d3.select(svgRef.current).transition().duration(750)
            .call(zoomRef.current.transform, targetTransform);
    }, []);


    // --- Effect for D3 visualization Setup & Simulation ---
    useEffect(() => {
        initialZoomAppliedByEnd.current = false;

        // --- Guards ---
        if (dimensions.width === 0 || dimensions.height === 0) { return; }
        if (!graphData || !graphData.nodes || !graphData.links || !svgRef.current || isLoading) {
            if (svgRef.current && (isLoading || !graphData) && dimensions.width > 0) {
                d3.select(svgRef.current).selectAll("*").remove();
                if (simulationRef.current) { simulationRef.current.stop(); simulationRef.current = null; }
                mainGroupRef.current = null; zoomRef.current = null;
                currentNodesRef.current = []; currentLinksRef.current = [];
            }
            return;
        }

        // --- D3 Setup ---
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();
        const g = svg.append('g').node();
        if (!g) return;
        mainGroupRef.current = g;
        const gSelection = d3.select(g);

        // Update node/link refs - Create copies!
        currentNodesRef.current = graphData.nodes.map(n => ({ ...n, x: undefined, y: undefined, fx: undefined, fy: undefined }));
        currentLinksRef.current = graphData.links.map(e => ({ ...e }));

        if (simulationRef.current) { simulationRef.current.stop(); }

        // --- Simulation Setup ---
        simulationRef.current = d3.forceSimulation<GraphNode, GraphLink>(currentNodesRef.current)
            .force('link', d3.forceLink<GraphNode, GraphLink>(currentLinksRef.current).id(d => d.id).distance(60).strength(0.4))
            .force('charge', d3.forceManyBody().strength(-180))
            .force('center', d3.forceCenter(0, 0)) // Center at origin instead of dimensions
            .force('collision', d3.forceCollide<GraphNode>().radius(d => (d.id === selectedPaper?.arxiv_id ? 12 : 8) + 2))
            .alphaDecay(0.03)
            .on('tick', ticked)
            .on('end', () => {
                const finalTransform = calculateTargetTransform();
                applyAnimatedZoom(finalTransform);
                initialZoomAppliedByEnd.current = true;
            });

        // --- Draw elements ---
        const edge = gSelection.append('g')
            .attr('class', 'links').attr('stroke', '#999').attr('stroke-opacity', 0.6)
            .selectAll('line').data(currentLinksRef.current).join('line')
            .attr('stroke-width', d => Math.sqrt(d.value || 1));

        const nodeGroup = gSelection.append('g')
            .selectAll<SVGGElement, GraphNode>('g').data(currentNodesRef.current, d => d.id)
            .join('g').attr('cursor', 'pointer')
            .on('click', (event, d) => { event.stopPropagation(); onNodeClick(d); });

        nodeGroup.append('circle')
            .attr('r', d => d.id === selectedPaper?.arxiv_id ? 10 : 6)
            .attr('fill', d => d.id === selectedPaper?.arxiv_id ? '#ff7f0e' : '#1f77b4');
        nodeGroup.append('title').text(d => d.paper?.title || d.id);
        nodeGroup.append('text')
            .attr('dx', d => (d.id === selectedPaper?.arxiv_id ? 14 : 10))
            .attr('dy', '.35em').attr('fill', '#333')
            .style('font-size', '10px').style('pointer-events', 'none')
            .text(d => {
                const title = d.paper?.title || String(d.id);
                return title.length > 25 ? title.substring(0, 25) + '...' : title;
            });
        nodeGroup.call(drag(simulationRef.current));

        // --- Tick function ---
        function ticked() {
            edge
                .attr('x1', d => (d.source as GraphNode).x ?? 0).attr('y1', d => (d.source as GraphNode).y ?? 0)
                .attr('x2', d => (d.target as GraphNode).x ?? 0).attr('y2', d => (d.target as GraphNode).y ?? 0);
            nodeGroup
                .attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
        }

        // --- Zoom setup ---
        zoomRef.current = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([MIN_ZOOM_SCALE, MAX_ZOOM_SCALE])
            .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
                if (mainGroupRef.current) {
                    d3.select(mainGroupRef.current).attr('transform', event.transform.toString());
                }
            });
        svg.call(zoomRef.current);

        // --- SET INITIAL ZOOM STATE (INSTANTLY) ---
        const initialTransform = calculateTargetTransform();
        zoomRef.current.transform(svg, initialTransform);

    }, [graphData, selectedPaper, dimensions, isLoading, onNodeClick, calculateTargetTransform, applyAnimatedZoom]);


    // --- Effect to handle selectedPaper changes AFTER initial load/sim end ---
    useEffect(() => {
        if (dimensions.width > 0 && zoomRef.current && initialZoomAppliedByEnd.current) {
            const targetTransform = calculateTargetTransform();
            applyAnimatedZoom(targetTransform);
        }
    }, [selectedPaper, calculateTargetTransform, applyAnimatedZoom, dimensions]);


    // --- Drag handler (unchanged) ---
    const drag = (simulation: d3.Simulation<GraphNode, GraphLink> | null) => {
        function dragstarted(event: d3.D3DragEvent<SVGGElement, GraphNode, any>, d: GraphNode) { if (!event.active && simulation) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }
        function dragged(event: d3.D3DragEvent<SVGGElement, GraphNode, any>, d: GraphNode) { d.fx = event.x; d.fy = event.y; }
        function dragended(event: d3.D3DragEvent<SVGGElement, GraphNode, any>, d: GraphNode) { if (!event.active && simulation) simulation.alphaTarget(0); /* Keep fixed: d.fx = null; d.fy = null; */ }
        return d3.drag<SVGGElement, GraphNode>().on('start', dragstarted).on('drag', dragged).on('end', dragended);
    }

    // --- Component Render ---
    return (
        <div ref={containerRef} className="w-full h-full relative overflow-hidden">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 z-10">
                    <CircularProgress />
                </div>
            )}
            {/* Use sx prop for Box styling */}
            {(!isLoading && (!graphData || currentNodesRef.current.length === 0)) && (
                <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    sx={{
                        position: 'absolute',
                        inset: 0
                    }}
                >
                    <Typography variant="body1" color="text.secondary">
                        {dimensions.width === 0 || dimensions.height === 0
                            ? "Initializing layout..."
                            : "No graph data available. Select a paper or search."}
                    </Typography>
                </Box>
            )}
            {/* Render SVG with explicit viewBox */}
            <svg
                ref={svgRef}
                className={`w-full h-full ${dimensions.width === 0 || dimensions.height === 0 ? 'invisible' : ''}`}
                viewBox={dimensions.width > 0 ? `0 0 ${dimensions.width} ${dimensions.height}` : undefined}
            />
        </div>
    );
};

export default GraphVisualization;
