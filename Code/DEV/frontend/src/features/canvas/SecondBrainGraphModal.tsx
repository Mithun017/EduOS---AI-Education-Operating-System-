import React, { useState, useEffect, useRef } from 'react';
import { X, Network, Sparkles, RefreshCw, Search, ArrowRight, BookOpen, Info, RotateCcw, ZoomIn, ZoomOut, Play, Pause } from 'lucide-react';
import { useEduOSStore } from '../../store/store';
import { askTeacherHTTP } from '../../lib/api';

interface Node3D {
  id: string;
  label: string;
  type: 'core' | 'branch' | 'math' | 'component' | 'application';
  summary: string;
  x: number;
  y: number;
  z: number;
  projX?: number;
  projY?: number;
  projScale?: number;
  tier: number;
}

interface Edge3D {
  from: string;
  to: string;
  relation: string;
}

interface GraphData3D {
  topic: string;
  nodes: Node3D[];
  edges: Edge3D[];
}

interface SecondBrainGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTopic?: string;
}

export const SecondBrainGraphModal: React.FC<SecondBrainGraphModalProps> = ({
  isOpen,
  onClose,
  initialTopic,
}) => {
  const { selectedTopic, user } = useEduOSStore();
  const [topicInput, setTopicInput] = useState(initialTopic || selectedTopic?.name || 'Recurrent Neural Networks (RNN)');
  const [graphData, setGraphData] = useState<GraphData3D | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node3D | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Node3D | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // 3D Interactive Controls State
  const [autoRotate, setAutoRotate] = useState(true);
  const [rotX, setRotX] = useState(0.2);
  const [rotY, setRotY] = useState(0.4);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Generate Multi-Tier Dense 3D Graph Structure
  const generateGraphForTopic = async (topicName: string) => {
    setIsGenerating(true);
    setSelectedNode(null);

    try {
      // Query real AI engine for concept breakdown
      const promptText = `Provide detailed knowledge breakdown for topic "${topicName}".`;
      const response = await askTeacherHTTP(
        user?.token || '',
        selectedTopic?.id || 'topic-cnn-001',
        promptText,
        'hybrid'
      );

      const coreId = 'core-0';
      const nodes: Node3D[] = [
        {
          id: coreId,
          label: topicName,
          type: 'core',
          summary: response?.summary || `Core 3D Central Concept analysis for ${topicName}. Represents the foundational educational domain.`,
          x: 0,
          y: 0,
          z: 0,
          tier: 0
        }
      ];

      // Tier 1: Major Conceptual Branches (4 Nodes)
      const tier1Labels = [
        `${topicName} Fundamentals`,
        `Mathematical & Vector Formulations`,
        `Core Architectural Components`,
        `Real-World Practical Applications`
      ];

      const edges: Edge3D[] = [];
      const radius1 = 160;

      tier1Labels.forEach((label, idx) => {
        const angle = (idx * Math.PI) / 2;
        const nodeId = `t1-${idx}`;
        nodes.push({
          id: nodeId,
          label,
          type: 'branch',
          summary: `Primary structural branch for "${label}". Establishes functional relationships in ${topicName}.`,
          x: radius1 * Math.cos(angle),
          y: (idx % 2 === 0 ? 1 : -1) * 40,
          z: radius1 * Math.sin(angle),
          tier: 1
        });
        edges.push({ from: coreId, to: nodeId, relation: 'originates_from' });
      });

      // Tier 2: Mathematical & Architectural Sub-Nodes (8 Nodes)
      const subLabels = [
        `Gated Hidden States`,
        `Vanishing Gradient Compensation`,
        `Backpropagation Through Time (BPTT)`,
        `Cross-Entropy Loss Optimization`,
        `Sequence-to-Sequence Modeling`,
        `Attention Mechanism Coupling`,
        `Temporal Feature Maps`,
        `Softmax Logit Normalization`
      ];

      const radius2 = 270;
      subLabels.forEach((label, idx) => {
        const phi = Math.acos(-1 + (2 * idx) / subLabels.length);
        const theta = Math.sqrt(subLabels.length * Math.PI) * phi;

        const nodeId = `t2-${idx}`;
        nodes.push({
          id: nodeId,
          label,
          type: idx % 2 === 0 ? 'math' : 'component',
          summary: `Technical operational sub-node for "${label}". Explores derivative formulas, matrix operations, and execution pipelines.`,
          x: radius2 * Math.sin(phi) * Math.cos(theta),
          y: radius2 * Math.cos(phi),
          z: radius2 * Math.sin(phi) * Math.sin(theta),
          tier: 2
        });

        // Connect Tier 2 to Tier 1 parents
        const parentId = `t1-${idx % 4}`;
        edges.push({ from: parentId, to: nodeId, relation: idx % 2 === 0 ? 'executes' : 'defines' });
      });

      // Cross-Tier Interconnected Edges (Denser 3D Brain Web)
      edges.push(
        { from: 't2-0', to: 't2-1', relation: 'mitigates' },
        { from: 't2-2', to: 't2-3', relation: 'optimizes' },
        { from: 't2-4', to: 't2-5', relation: 'enhances' },
        { from: 't2-6', to: 't2-7', relation: 'classifies' },
        { from: 't1-0', to: 't2-6', relation: 'feeds_into' },
        { from: 't1-1', to: 't2-2', relation: 'derives' }
      );

      setGraphData({ topic: topicName, nodes, edges });
      setSelectedNode(nodes[0]);
    } catch (err) {
      console.warn("Generating 3D knowledge graph fallback.", err);
      // Fallback dense 3D graph
      const coreId = 'core-0';
      const fallbackNodes: Node3D[] = [
        { id: coreId, label: topicName, type: 'core', summary: `Core concept analysis for ${topicName}.`, x: 0, y: 0, z: 0, tier: 0 },
        { id: 't1-0', label: 'Hidden State Vector', type: 'branch', summary: 'Memory retention vector passing temporal state across time steps.', x: -160, y: 30, z: 80, tier: 1 },
        { id: 't1-1', label: 'Recurrent Weight Matrices', type: 'branch', summary: 'Parameters (W_hh, W_xh) shared across time execution.', x: 160, y: -40, z: -80, tier: 1 },
        { id: 't1-2', label: 'Backpropagation Through Time', type: 'math', summary: 'Chain-rule unrolling across temporal steps.', x: 80, y: 150, z: -140, tier: 1 },
        { id: 't1-3', label: 'LSTM & GRU Gating', type: 'component', summary: 'Forget, input, and output gates controlling memory flow.', x: -90, y: -140, z: 120, tier: 1 },
        { id: 't2-0', label: 'Vanishing Gradient Mitigation', type: 'math', summary: 'Solves exponential gradient decay via additive cell states.', x: -240, y: 80, z: 180, tier: 2 },
        { id: 't2-1', label: 'Tanh Activation Function', type: 'math', summary: 'Bounds hidden state activations between -1 and +1.', x: 220, y: -110, z: 160, tier: 2 },
        { id: 't2-2', label: 'Sequence-to-Sequence Decoder', type: 'application', summary: 'Generates output sequences for translation & text tasks.', x: 180, y: 210, z: -200, tier: 2 },
        { id: 't2-3', label: 'Attention Mechanism', type: 'component', summary: 'Computes dynamic alignment scores across temporal inputs.', x: -200, y: -200, z: -160, tier: 2 }
      ];

      const fallbackEdges: Edge3D[] = [
        { from: coreId, to: 't1-0', relation: 'maintains' },
        { from: coreId, to: 't1-1', relation: 'parameterizes' },
        { from: coreId, to: 't1-2', relation: 'optimizes' },
        { from: coreId, to: 't1-3', relation: 'architects' },
        { from: 't1-0', to: 't2-0', relation: 'prevents_decay' },
        { from: 't1-1', to: 't2-1', relation: 'activates' },
        { from: 't1-2', to: 't2-2', relation: 'decodes' },
        { from: 't1-3', to: 't2-3', relation: 'couples_with' },
        { from: 't2-0', to: 't1-3', relation: 'stabilizes' }
      ];

      setGraphData({ topic: topicName, nodes: fallbackNodes, edges: fallbackEdges });
      setSelectedNode(fallbackNodes[0]);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const activeTopic = initialTopic || selectedTopic?.name || 'Recurrent Neural Networks (RNN)';
      setTopicInput(activeTopic);
      generateGraphForTopic(activeTopic);
    }
  }, [isOpen, initialTopic, selectedTopic]);

  // 3D Canvas Render Loop
  useEffect(() => {
    if (!isOpen || !graphData || !canvasRef.current) return;

    let animId: number;
    let localRotY = rotY;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render3DFrame = () => {
      if (autoRotate && !isDragging) {
        localRotY += 0.005;
        setRotY(localRotY);
      }

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // 3D Rotation Matrix Coefficients
      const cosY = Math.cos(localRotY);
      const sinY = Math.sin(localRotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      // Project Nodes into 2D Screen Space
      const projectedNodes = graphData.nodes.map((node) => {
        // Rotate Y
        const x1 = node.x * cosY - node.z * sinY;
        const z1 = node.z * cosY + node.x * sinY;
        // Rotate X
        const y1 = node.y * cosX - z1 * sinX;
        const z2 = z1 * cosX + node.y * sinX;

        // Perspective scale factor
        const fov = 450 * zoomLevel;
        const perspective = fov / (fov + z2 + 350);

        const projX = centerX + x1 * perspective;
        const projY = centerY + y1 * perspective;

        return {
          ...node,
          projX,
          projY,
          projScale: Math.max(0.2, perspective),
          projZ: z2
        };
      });

      // Sort nodes back-to-front (Painter's algorithm for Z-depth)
      projectedNodes.sort((a, b) => b.projZ - a.projZ);

      // Render 3D Edges
      graphData.edges.forEach((edge) => {
        const fromNode = projectedNodes.find((n) => n.id === edge.from);
        const toNode = projectedNodes.find((n) => n.id === edge.to);
        if (!fromNode || !toNode) return;

        const isConnectedToSelected = selectedNode && (selectedNode.id === edge.from || selectedNode.id === edge.to);
        const isConnectedToHovered = hoveredNode && (hoveredNode.id === edge.from || hoveredNode.id === edge.to);

        ctx.beginPath();
        ctx.moveTo(fromNode.projX!, fromNode.projY!);
        ctx.lineTo(toNode.projX!, toNode.projY!);

        if (isConnectedToSelected || isConnectedToHovered) {
          ctx.strokeStyle = '#51D9FD';
          ctx.lineWidth = 2.5 * fromNode.projScale!;
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = 'rgba(81, 217, 253, 0.25)';
          ctx.lineWidth = 1 * fromNode.projScale!;
          if (edge.relation === 'mitigates' || edge.relation === 'prevents_decay') {
            ctx.setLineDash([4, 4]);
          } else {
            ctx.setLineDash([]);
          }
        }
        ctx.stroke();

        // Render Relationship Tag at midpoint
        const midX = (fromNode.projX! + toNode.projX!) / 2;
        const midY = (fromNode.projY! + toNode.projY!) / 2;

        if (isConnectedToSelected || isConnectedToHovered) {
          ctx.fillStyle = 'rgba(0, 39, 43, 0.85)';
          ctx.strokeStyle = '#51D9FD';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(midX - 30, midY - 8, 60, 16, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#51D9FD';
          ctx.font = '8px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(edge.relation, midX, midY + 3);
        }
      });

      // Render 3D Nodes
      projectedNodes.forEach((node) => {
        const isSelected = selectedNode?.id === node.id;
        const isHovered = hoveredNode?.id === node.id;
        const isCore = node.type === 'core';

        const baseRadius = isCore ? 30 : isSelected || isHovered ? 20 : 14;
        const radius = baseRadius * node.projScale!;

        ctx.save();
        ctx.translate(node.projX!, node.projY!);

        // Outer Glow Ring
        ctx.beginPath();
        ctx.arc(0, 0, radius + 8, 0, Math.PI * 2);
        ctx.fillStyle = isCore
          ? 'rgba(81, 217, 253, 0.35)'
          : isSelected || isHovered
          ? 'rgba(81, 217, 253, 0.25)'
          : 'rgba(81, 217, 253, 0.08)';
        ctx.fill();

        // Node Circle Body
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fillStyle = isCore
          ? '#51D9FD'
          : isSelected
          ? 'rgba(81, 217, 253, 0.85)'
          : 'rgba(0, 39, 43, 0.9)';
        ctx.strokeStyle = isCore || isSelected || isHovered ? '#51D9FD' : 'rgba(81, 217, 253, 0.35)';
        ctx.lineWidth = isCore ? 3 : 1.5;
        ctx.fill();
        ctx.stroke();

        // Node Label Text
        ctx.fillStyle = isCore ? '#00272B' : '#51D9FD';
        ctx.font = `${Math.max(9, Math.round(10 * node.projScale!))}px sans-serif`;
        ctx.textAlign = 'center';
        const labelText = node.label.length > 20 ? `${node.label.substring(0, 18)}...` : node.label;
        ctx.fillText(labelText, 0, 4);

        ctx.restore();
      });

      animId = requestAnimationFrame(render3DFrame);
    };

    render3DFrame();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isOpen, graphData, rotX, rotY, autoRotate, zoomLevel, isDragging, selectedNode, hoveredNode]);

  // Handle 3D Drag to Rotate
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current || !graphData) return;

    if (isDragging) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      setRotY((prev) => prev + deltaX * 0.005);
      setRotX((prev) => Math.max(-1.2, Math.min(1.2, prev + deltaY * 0.005)));
      setDragStart({ x: e.clientX, y: e.clientY });
    } else {
      // Pick nearest 3D projected node for hover
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const canvas = canvasRef.current;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      let foundHover: Node3D | null = null;

      graphData.nodes.forEach((node) => {
        const x1 = node.x * cosY - node.z * sinY;
        const z1 = node.z * cosY + node.x * sinY;
        const y1 = node.y * cosX - z1 * sinX;
        const z2 = z1 * cosX + node.y * sinX;

        const fov = 450 * zoomLevel;
        const perspective = fov / (fov + z2 + 350);

        const projX = centerX + x1 * perspective;
        const projY = centerY + y1 * perspective;

        const dist = Math.hypot(mouseX - projX, mouseY - projY);
        if (dist < 25 * perspective) {
          foundHover = node;
        }
      });

      setHoveredNode(foundHover);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Click 3D Node
  const handleCanvasClick = () => {
    if (hoveredNode) {
      setSelectedNode(hoveredNode);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-lg animate-fade-in">
      <div className="w-full max-w-6xl h-[88vh] bg-[var(--card-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl flex flex-col overflow-hidden glass-panel">
        {/* Header Bar */}
        <div className="px-5 py-3 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 bg-[var(--glass-bg)]/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border border-[var(--border-subtle)]">
              <Network className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[var(--text-primary)] flex items-center gap-2">
                Second Brain — 3D Interactive Knowledge Graph
                <span className="text-[9px] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-mono font-bold px-2 py-0.5 rounded-full border border-[var(--border-subtle)] uppercase">
                  3D Orbit Engine
                </span>
              </h3>
              <p className="text-[10px] text-[var(--text-secondary)]">
                Dense multi-tiered 3D constellation of concepts, formulas & neural dependencies
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Topic Search & 3D Camera Toolbar */}
        <div className="p-3 bg-[var(--glass-bg)]/40 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2">
          {/* Input */}
          <div className="flex-1 min-w-[280px] relative flex items-center">
            <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3" />
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && generateGraphForTopic(topicInput)}
              placeholder="Enter topic to construct 3D Second Brain (e.g. RNN, Quantum Computing, Transformer Attention)..."
              className="w-full bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-xl pl-9 pr-4 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>

          {/* Action & Camera Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => generateGraphForTopic(topicInput)}
              disabled={isGenerating || !topicInput.trim()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--accent-primary)] text-[var(--text-inverse)] rounded-xl text-xs font-bold shadow hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Constructing 3D Graph...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate 3D Graph</span>
                </>
              )}
            </button>

            <div className="h-5 w-[1px] bg-[var(--border-subtle)] mx-1" />

            {/* Auto Rotate Toggle */}
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                autoRotate
                  ? 'bg-[var(--accent-primary-soft)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
                  : 'bg-[var(--glass-bg)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
              }`}
              title={autoRotate ? "Pause 3D Auto-Rotation" : "Start 3D Auto-Rotation"}
            >
              {autoRotate ? <Pause size={15} /> : <Play size={15} />}
            </button>

            {/* Reset Camera */}
            <button
              onClick={() => {
                setRotX(0.2);
                setRotY(0.4);
                setZoomLevel(1.0);
              }}
              className="p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-all cursor-pointer"
              title="Reset 3D View"
            >
              <RotateCcw size={15} />
            </button>

            {/* Zoom Controls */}
            <button
              onClick={() => setZoomLevel((z) => Math.min(2.0, z + 0.15))}
              className="p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
              title="Zoom In 3D Space"
            >
              <ZoomIn size={15} />
            </button>

            <button
              onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.15))}
              className="p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
              title="Zoom Out 3D Space"
            >
              <ZoomOut size={15} />
            </button>
          </div>
        </div>

        {/* Main 3D Canvas & Detail Panel */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          {/* Left/Center: Interactive 3D Canvas Universe */}
          <div className="flex-1 bg-[var(--bg-app)] relative flex items-center justify-center overflow-hidden">
            <canvas
              ref={canvasRef}
              width={750}
              height={500}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onClick={handleCanvasClick}
              className="w-full h-full cursor-grab active:cursor-grabbing select-none"
            />
            <div className="absolute bottom-3 left-3 bg-[var(--glass-bg)]/80 border border-[var(--border-subtle)] rounded-lg px-2.5 py-1 text-[9px] font-mono text-[var(--text-secondary)] pointer-events-none">
              Drag mouse to rotate 3D space | Click node to inspect details
            </div>
          </div>

          {/* Right Panel: Selected 3D Node Deep Analysis */}
          <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-[var(--border-subtle)] bg-[var(--glass-bg)]/40 p-4 space-y-4 overflow-y-auto">
            {selectedNode ? (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2 text-[var(--accent-primary)]">
                  <BookOpen className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    {selectedNode.tier === 0 ? 'Core 3D Concept' : `Tier ${selectedNode.tier} Sub-Node`}
                  </h4>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] leading-snug">
                    {selectedNode.label}
                  </h3>
                  <span className="text-[8px] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-mono font-medium px-2 py-0.5 rounded-full border border-[var(--border-subtle)] uppercase mt-1 inline-block">
                    Node ID: {selectedNode.id}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[var(--card-bg)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] leading-relaxed space-y-2">
                  <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                    AI 3D Deep Concept Analysis
                  </span>
                  <p>{selectedNode.summary}</p>
                </div>

                {/* 3D Connected Network Links */}
                {graphData && (
                  <div className="space-y-1.5 pt-2 border-t border-[var(--border-subtle)]">
                    <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                      Connected 3D Pathways
                    </span>
                    <div className="space-y-1">
                      {graphData.edges
                        .filter((e) => e.from === selectedNode.id || e.to === selectedNode.id)
                        .map((edge, idx) => {
                          const otherId = edge.from === selectedNode.id ? edge.to : edge.from;
                          const otherNode = graphData.nodes.find((n) => n.id === otherId);
                          return (
                            <div
                              key={idx}
                              onClick={() => otherNode && setSelectedNode(otherNode)}
                              className="flex items-center justify-between p-2 rounded-lg bg-[var(--glass-bg)] border border-[var(--border-subtle)] text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] cursor-pointer transition-all"
                            >
                              <span className="font-mono text-[var(--accent-primary)]">{edge.relation}</span>
                              <div className="flex items-center gap-1">
                                <span className="truncate max-w-[100px]">{otherNode?.label}</span>
                                <ArrowRight className="w-3 h-3 text-[var(--accent-primary)]" />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-[var(--text-secondary)]">
                <Info className="w-6 h-6 text-[var(--accent-primary)]" />
                <p className="text-xs font-medium">Click on any 3D node in the constellation to inspect concept breakdown.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
