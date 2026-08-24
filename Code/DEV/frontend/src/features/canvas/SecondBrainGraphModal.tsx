import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Network, Sparkles, RefreshCw, Search, ArrowRight, BookOpen, Info, RotateCcw, ZoomIn, ZoomOut, Play, Pause, Compass, CheckCircle2, Circle, CheckSquare, Trophy } from 'lucide-react';
import { useEduOSStore } from '../../store/store';
import { fetch3DKnowledgeGraph } from '../../lib/api';

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

interface RoadmapSubItem {
  id: string;
  title: string;
  type?: 'recommended' | 'alternative' | 'optional';
  summary?: string;
}

interface RoadmapSection {
  id: string;
  title: string;
  type?: 'recommended' | 'alternative' | 'optional';
  summary?: string;
  sub_items?: RoadmapSubItem[];
}

interface RoadmapPhase {
  id: string;
  phase_number: number;
  title: string;
  duration: string;
  status: string;
  summary: string;
  key_topics: string[];
  milestone_project: string;
  sections?: RoadmapSection[];
}

interface RoadmapData {
  total_duration: string;
  phases: RoadmapPhase[];
}

interface GraphData3D {
  topic: string;
  nodes: Node3D[];
  edges: Edge3D[];
  roadmap?: RoadmapData;
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
  const [topicInput, setTopicInput] = useState(initialTopic || selectedTopic?.name || 'Convolutional Neural Networks (CNN)');
  const [graphData, setGraphData] = useState<GraphData3D | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node3D | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Node3D | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // View mode state (3D Graph vs Timeline Roadmap)
  const [modalView, setModalView] = useState<'graph' | 'roadmap'>('graph');

  // Interactive Roadmap Checkbox Progress State
  const [completedNodeIds, setCompletedNodeIds] = useState<Set<string>>(new Set());
  const [selectedRoadmapItem, setSelectedRoadmapItem] = useState<{
    id: string;
    title: string;
    type?: string;
    summary: string;
    phaseTitle?: string;
    project?: string;
  } | null>(null);

  // Toggle completion of any roadmap node
  const toggleNodeCompletion = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCompletedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Helper to extract all node IDs for global completion calculation
  const getAllRoadmapNodeIds = (): string[] => {
    if (!graphData?.roadmap?.phases) return [];
    const ids: string[] = [];
    graphData.roadmap.phases.forEach((phase) => {
      ids.push(phase.id);
      (phase.sections || []).forEach((sec) => {
        ids.push(sec.id);
        (sec.sub_items || []).forEach((item) => {
          ids.push(item.id);
        });
      });
    });
    return ids;
  };

  const allRoadmapIds = getAllRoadmapNodeIds();
  const completedCount = allRoadmapIds.filter((id) => completedNodeIds.has(id)).length;
  const totalRoadmapNodes = allRoadmapIds.length || 1;
  const completionPercentage = Math.round((completedCount / totalRoadmapNodes) * 100);

  const handleMarkAllCompleted = () => {
    setCompletedNodeIds(new Set(allRoadmapIds));
  };

  const handleResetProgress = () => {
    setCompletedNodeIds(new Set());
  };

  // 3D Interactive Controls State (X, Y, Z Axis)
  const [autoRotate, setAutoRotate] = useState(true);
  const [rotX, setRotX] = useState(0.25);
  const [rotY, setRotY] = useState(0.4);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Reset X, Y, Z camera view to default
  const handleReset3DView = () => {
    setRotX(0.25);
    setRotY(0.4);
    setPanX(0);
    setPanY(0);
    setZoomLevel(1.0);
  };

  // Generate Multi-Tier Dense 3D Graph Structure via AI
  const generateGraphForTopic = async (topicName: string) => {
    setIsGenerating(true);
    setSelectedNode(null);

    try {
      // Query backend AI Orchestrator for dynamic 3D Knowledge Graph
      const data = await fetch3DKnowledgeGraph(user?.token || '', topicName);
      if (data && data.nodes && data.nodes.length > 0) {
        setGraphData(data);
        setSelectedNode(data.nodes[0]);
      } else {
        throw new Error("Empty AI graph output");
      }
    } catch (err) {
      console.warn("Generating 3D knowledge graph fallback.", err);
      const coreId = 'core-0';
      const fallbackNodes: Node3D[] = [
        { id: coreId, label: topicName, type: 'core', summary: `Core concept analysis for ${topicName}.`, x: 0, y: 0, z: 0, tier: 0 },
        { id: 't1-0', label: `${topicName} Foundations`, type: 'branch', summary: `Foundational mathematical principles of ${topicName}.`, x: -340, y: 80, z: 180, tier: 1 },
        { id: 't1-1', label: `Architectural Nodes`, type: 'branch', summary: `Structural components and transformations.`, x: 340, y: -80, z: -180, tier: 1 },
        { id: 't1-2', label: `Mathematical Formulations`, type: 'math', summary: 'Derivative chain-rules & matrix operations.', x: 180, y: 300, z: -340, tier: 1 },
        { id: 't1-3', label: `Real-World Deployment`, type: 'component', summary: 'Practical applications & production models.', x: -200, y: -300, z: 280, tier: 1 },
        { id: 't2-0', label: 'Feature Map Normalization', type: 'math', summary: 'Standardizes vector scaling across layers.', x: -520, y: 165, z: 360, tier: 2 },
        { id: 't2-1', label: 'Non-Linear Activations', type: 'math', summary: 'Applies threshold functions to embeddings.', x: 520, y: -220, z: 320, tier: 2 },
        { id: 't2-2', label: 'Dimensionality Reduction', type: 'application', summary: 'Compresses spatial dimensions efficiently.', x: 420, y: 440, z: -460, tier: 2 },
        { id: 't2-3', label: 'Gradient Loss Optimization', type: 'component', summary: 'Computes loss derivatives for weight updates.', x: -460, y: -420, z: -380, tier: 2 }
      ];

      const fallbackEdges: Edge3D[] = [
        { from: coreId, to: 't1-0', relation: 'maintains' },
        { from: coreId, to: 't1-1', relation: 'parameterizes' },
        { from: coreId, to: 't1-2', relation: 'optimizes' },
        { from: coreId, to: 't1-3', relation: 'architects' },
        { from: 't1-0', to: 't2-0', relation: 'normalizes' },
        { from: 't1-1', to: 't2-1', relation: 'activates' },
        { from: 't1-2', to: 't2-2', relation: 'compresses' },
        { from: 't1-3', to: 't2-3', relation: 'updates' },
        { from: 't1-0', to: 't1-2', relation: 'correlates_with' },
        { from: 't1-1', to: 't1-3', relation: 'deploys_to' },
        { from: 't2-0', to: 't2-1', relation: 'transforms' }
      ];

      setGraphData({ topic: topicName, nodes: fallbackNodes, edges: fallbackEdges });
      setSelectedNode(fallbackNodes[0]);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const activeTopic = initialTopic || selectedTopic?.name || 'Convolutional Neural Networks (CNN)';
      setTopicInput(activeTopic);
      generateGraphForTopic(activeTopic);
    }
  }, [isOpen, initialTopic, selectedTopic]);

  // 3D Canvas Render Loop (Constellation Web Mesh)
  useEffect(() => {
    if (!isOpen || !graphData || !canvasRef.current) return;

    let animId: number;
    let localRotY = rotY;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render3DFrame = () => {
      if (autoRotate && !isDragging && !isPanning) {
        localRotY += 0.003;
        setRotY(localRotY);
      }

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2 + panX;
      const centerY = height / 2 + panY;

      // Dark Constellation Universe Canvas Background
      ctx.fillStyle = '#0B0F19';
      ctx.fillRect(0, 0, width, height);

      // 3D Rotation Matrix Coefficients
      const cosY = Math.cos(localRotY);
      const sinY = Math.sin(localRotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      // Project Nodes into 2D Screen Space with Z-Depth
      const projectedNodes = graphData.nodes.map((node) => {
        const x1 = node.x * cosY - node.z * sinY;
        const z1 = node.z * cosY + node.x * sinY;
        const y1 = node.y * cosX - z1 * sinX;
        const z2 = z1 * cosX + node.y * sinX;

        const fov = 450 * zoomLevel;
        const perspective = fov / (fov + z2 + 350);

        const projX = centerX + x1 * perspective;
        const projY = centerY + y1 * perspective;

        return {
          ...node,
          projX,
          projY,
          projScale: Math.max(0.15, perspective),
          projZ: z2
        };
      });

      // Sort nodes back-to-front (Painter's Z-depth algorithm)
      projectedNodes.sort((a, b) => b.projZ - a.projZ);

      // Render 3D Constellation Mesh Lines (Edges)
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
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 2.2 * fromNode.projScale!;
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
          ctx.lineWidth = 1.2 * fromNode.projScale!;
          if (edge.relation === 'mitigates' || edge.relation === 'prevents_decay') {
            ctx.setLineDash([3, 3]);
          } else {
            ctx.setLineDash([]);
          }
        }
        ctx.stroke();

        // Relationship Tag at midpoint on active edges
        if (isConnectedToSelected || isConnectedToHovered) {
          const midX = (fromNode.projX! + toNode.projX!) / 2;
          const midY = (fromNode.projY! + toNode.projY!) / 2;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(midX - 32, midY - 9, 64, 18, 5);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#38BDF8';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(edge.relation, midX, midY);
        }
      });

      // Render 3D Constellation Sphere Dot Nodes
      projectedNodes.forEach((node) => {
        const isSelected = selectedNode?.id === node.id;
        const isHovered = hoveredNode?.id === node.id;
        const isCore = node.type === 'core';

        const baseDotRadius = isCore ? 10 : isSelected || isHovered ? 7.5 : 5.5;
        const radius = baseDotRadius * node.projScale!;

        ctx.save();
        ctx.translate(node.projX!, node.projY!);

        // Outer Glow Halo Ring
        ctx.beginPath();
        ctx.arc(0, 0, radius + (isCore ? 8 : 5), 0, Math.PI * 2);
        ctx.fillStyle = isCore
          ? 'rgba(139, 92, 246, 0.35)'
          : isSelected || isHovered
          ? 'rgba(56, 189, 248, 0.35)'
          : 'rgba(255, 255, 255, 0.08)';
        ctx.fill();

        // Node Dot Sphere Body
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);

        if (isCore) {
          ctx.fillStyle = '#FFFFFF';
          ctx.strokeStyle = '#8B5CF6';
          ctx.lineWidth = 3;
        } else if (isSelected || isHovered) {
          ctx.fillStyle = '#38BDF8';
          ctx.strokeStyle = '#7DD3FC';
          ctx.lineWidth = 2.5;
        } else {
          switch (node.type) {
            case 'branch': ctx.fillStyle = '#38BDF8'; break;
            case 'math': ctx.fillStyle = '#C084FC'; break;
            case 'component': ctx.fillStyle = '#34D399'; break;
            case 'application': ctx.fillStyle = '#FBBF24'; break;
            default: ctx.fillStyle = '#94A3B8';
          }
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.lineWidth = 1;
        }

        ctx.fill();
        ctx.stroke();

        // Adjacent Floating Text Label
        const labelText = node.label.length > 24 ? `${node.label.substring(0, 22)}...` : node.label;
        ctx.font = isCore
          ? `bold ${Math.max(11, Math.round(13 * node.projScale!))}px sans-serif`
          : `500 ${Math.max(9, Math.round(10.5 * node.projScale!))}px sans-serif`;

        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 5;
        ctx.fillStyle = isCore
          ? '#FFFFFF'
          : isSelected || isHovered
          ? '#38BDF8'
          : '#E2E8F0';

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, radius + 7, 0);

        ctx.restore();
      });

      animId = requestAnimationFrame(render3DFrame);
    };

    render3DFrame();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isOpen, graphData, rotX, rotY, panX, panY, autoRotate, zoomLevel, isDragging, isPanning, selectedNode, hoveredNode]);

  // Handle 3D Drag to Rotate / Pan (X, Y, Z Motion)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2 || e.shiftKey) {
      // Right Click or Shift+Drag = Pan Mode (X & Y translation)
      setIsPanning(true);
    } else {
      // Left Click Drag = Rotate Mode (X & Y rotation)
      setIsDragging(true);
    }
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current || !graphData) return;

    if (isPanning) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      setPanX((prev) => prev + deltaX);
      setPanY((prev) => prev + deltaY);
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (isDragging) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      setRotY((prev) => prev + deltaX * 0.005);
      setRotX((prev) => Math.max(-1.4, Math.min(1.4, prev + deltaY * 0.005)));
      setDragStart({ x: e.clientX, y: e.clientY });
    } else {
      // Pick nearest 3D projected node for hover
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const canvas = canvasRef.current;
      const centerX = canvas.width / 2 + panX;
      const centerY = canvas.height / 2 + panY;
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
        if (dist < 22 * perspective) {
          foundHover = node;
        }
      });

      setHoveredNode(foundHover);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsPanning(false);
  };

  // Click 3D Node
  const handleCanvasClick = () => {
    if (hoveredNode) {
      setSelectedNode(hoveredNode);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-xl animate-fade-in">
      <div className="w-full max-w-7xl h-[92vh] bg-[var(--card-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl flex flex-col overflow-hidden glass-panel">
        {/* Header Bar */}
        <div className="px-5 py-3 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 bg-[var(--glass-bg)]/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border border-[var(--border-subtle)]">
              <Network className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[var(--text-primary)] flex items-center gap-2">
                Second Brain — AI Knowledge Suite
                <span className="text-[9px] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-mono font-bold px-2 py-0.5 rounded-full border border-[var(--border-subtle)] uppercase">
                  {modalView === 'graph' ? '3D Orbit Engine' : 'Sequential Timeline'}
                </span>
              </h3>
              <p className="text-[10px] text-[var(--text-secondary)]">
                {modalView === 'graph'
                  ? 'Dense multi-tiered 3D constellation of concepts, formulas & neural dependencies'
                  : 'AI-generated milestone learning roadmap & estimated execution timeline'}
              </p>
            </div>
          </div>

          {/* View Mode Switcher Button */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[var(--accent-primary-soft)] p-1 rounded-xl border border-[var(--border-subtle)]">
              <button
                onClick={() => setModalView('graph')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  modalView === 'graph'
                    ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)] shadow-md'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                <span>3D Graphical View</span>
              </button>

              <button
                onClick={() => setModalView('roadmap')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  modalView === 'roadmap'
                    ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)] shadow-md'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Timeline Roadmap</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-all cursor-pointer shadow-sm ml-2"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Topic Search & Controls Toolbar */}
        <div className="p-3 bg-[var(--glass-bg)]/40 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2">
          {/* Input */}
          <div className="flex-1 min-w-[280px] relative flex items-center">
            <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3" />
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && generateGraphForTopic(topicInput)}
              placeholder="Enter topic to construct 3D Second Brain & Roadmap (e.g. RNN, Quantum Computing, LLMs)..."
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
                  <span>Generating AI Suite...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Graph & Roadmap</span>
                </>
              )}
            </button>

            {modalView === 'graph' && (
              <>
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
              </>
            )}
          </div>
        </div>

        {/* Modal Main Body */}
        {modalView === 'roadmap' ? (
          /* PRODUCTION INTERACTIVE ROADMAP.SH TREE VIEW */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
            {/* Left/Center: Interactive Branch Tree & Progress Bar */}
            <div className="flex-1 bg-[var(--bg-app)] p-5 md:p-6 overflow-y-auto space-y-5">
              {/* Overall Completion Percentage Header Bar */}
              <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-subtle)] shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Trophy className="w-5 h-5 text-[var(--accent-primary)] animate-bounce" />
                    <div>
                      <h4 className="font-extrabold text-sm text-[var(--text-primary)]">
                        Mastery Completion: <span className="text-[var(--accent-primary)] font-mono">{completionPercentage}%</span>
                      </h4>
                      <p className="text-[10px] text-[var(--text-secondary)]">
                        {completedCount} of {totalRoadmapNodes} modules mastered in {graphData?.topic || topicInput}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleMarkAllCompleted}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-[var(--border-subtle)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] hover:border-[var(--accent-primary)] transition-all cursor-pointer flex items-center gap-1"
                    >
                      <CheckSquare size={12} />
                      <span>Mark All</span>
                    </button>
                    <button
                      onClick={handleResetProgress}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold border border-[var(--border-subtle)] bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:text-rose-500 hover:border-rose-500 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw size={12} />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>

                {/* Smooth Animated Progress Bar */}
                <div className="w-full bg-[var(--input-bg)] border border-[var(--border-subtle)] h-3 rounded-full overflow-hidden p-0.5 shadow-inner">
                  <div
                    className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-sm"
                    style={{ width: `${completionPercentage}%` }}
                  />
                </div>
              </div>

              {/* Roadmap.sh Legend Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[var(--glass-bg)]/60 border border-[var(--border-subtle)] text-[10px]">
                <div className="flex flex-wrap items-center gap-3 font-semibold">
                  <span className="flex items-center gap-1 text-purple-400 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" /> Personal Recommendation
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Alternative Option
                  </span>
                  <span className="flex items-center gap-1 text-slate-400 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" /> Optional / Advanced
                  </span>
                </div>
                <span className="text-[9px] font-mono text-[var(--text-secondary)]">Click checkbox to track your progress</span>
              </div>

              {/* Interactive Roadmap Tree Nodes (roadmap.sh style vertical spine & branches) */}
              <div className="relative max-w-3xl mx-auto space-y-8 py-2">
                {(graphData?.roadmap?.phases || []).map((phase: RoadmapPhase) => {
                  const isPhaseCompleted = completedNodeIds.has(phase.id);
                  return (
                    <div key={phase.id} className="space-y-4 relative">
                      {/* Central Spine Main Phase Header Box */}
                      <div
                        onClick={() => setSelectedRoadmapItem({
                          id: phase.id,
                          title: phase.title,
                          type: 'recommended',
                          summary: phase.summary,
                          phaseTitle: `Phase ${phase.phase_number}`,
                          project: phase.milestone_project
                        })}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer shadow-lg flex items-center justify-between gap-4 ${
                          isPhaseCompleted
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300'
                            : 'bg-[#FFEB3B]/10 border-[#FBC02D] text-[var(--text-primary)] hover:border-[var(--accent-primary)]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Interactive Checkbox */}
                          <button
                            onClick={(e) => toggleNodeCompletion(phase.id, e)}
                            className="p-1 rounded-lg hover:scale-110 transition-transform cursor-pointer"
                            title={isPhaseCompleted ? "Mark incomplete" : "Mark completed"}
                          >
                            {isPhaseCompleted ? (
                              <CheckCircle2 className="w-6 h-6 text-emerald-400 fill-emerald-500/20" />
                            ) : (
                              <Circle className="w-6 h-6 text-[#FBC02D] hover:text-emerald-400 transition-colors" />
                            )}
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold font-mono uppercase bg-[#FBC02D] text-black">
                                Phase {phase.phase_number}
                              </span>
                              <span className="text-xs font-bold font-mono text-[var(--accent-primary)] bg-[var(--accent-primary-soft)] px-2 py-0.5 rounded-md border border-[var(--border-subtle)]">
                                ⏱️ {phase.duration}
                              </span>
                            </div>
                            <h3 className={`font-bold text-sm mt-1 ${isPhaseCompleted ? 'line-through opacity-80' : ''}`}>
                              {phase.title}
                            </h3>
                          </div>
                        </div>

                        <span className="text-[10px] font-bold text-[var(--text-secondary)] bg-[var(--card-bg)] px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] whitespace-nowrap">
                          {phase.status}
                        </span>
                      </div>

                      {/* Sections under phase */}
                      {phase.sections && phase.sections.length > 0 && (
                        <div className="pl-6 space-y-4 border-l-2 border-dashed border-[#FBC02D]/40 ml-6">
                          {phase.sections.map((sec: RoadmapSection) => {
                            const isSecCompleted = completedNodeIds.has(sec.id);
                            return (
                              <div key={sec.id} className="space-y-2">
                                {/* Spine Section Node Box */}
                                <div
                                  onClick={() => setSelectedRoadmapItem({
                                    id: sec.id,
                                    title: sec.title,
                                    type: sec.type || 'recommended',
                                    summary: sec.summary || `Section topic in Phase ${phase.phase_number}`,
                                    phaseTitle: `Phase ${phase.phase_number}: ${phase.title}`
                                  })}
                                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                    isSecCompleted
                                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300'
                                      : sec.type === 'alternative'
                                      ? 'bg-emerald-500/5 border-emerald-500/40 text-[var(--text-primary)] hover:border-emerald-500'
                                      : 'bg-[var(--card-bg)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <button
                                      onClick={(e) => toggleNodeCompletion(sec.id, e)}
                                      className="hover:scale-110 transition-transform cursor-pointer"
                                    >
                                      {isSecCompleted ? (
                                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                      ) : (
                                        <Circle className="w-5 h-5 text-[var(--text-secondary)] hover:text-emerald-400 transition-colors" />
                                      )}
                                    </button>
                                    <h4 className={`text-xs font-bold ${isSecCompleted ? 'line-through opacity-70' : ''}`}>
                                      {sec.title}
                                    </h4>
                                  </div>
                                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border border-[var(--border-subtle)] uppercase bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]">
                                    {sec.type || 'Recommended'}
                                  </span>
                                </div>

                                {/* Sub-items branching right */}
                                {sec.sub_items && sec.sub_items.length > 0 && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-4">
                                    {sec.sub_items.map((sub: RoadmapSubItem) => {
                                      const isSubCompleted = completedNodeIds.has(sub.id);
                                      return (
                                        <div
                                          key={sub.id}
                                          onClick={() => setSelectedRoadmapItem({
                                            id: sub.id,
                                            title: sub.title,
                                            type: sub.type || 'recommended',
                                            summary: sub.summary || `Detailed sub-topic under ${sec.title}`,
                                            phaseTitle: `Section: ${sec.title}`
                                          })}
                                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 text-xs ${
                                            isSubCompleted
                                              ? 'bg-emerald-500/10 border-emerald-500/60 text-emerald-300'
                                              : 'bg-[var(--glass-bg)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary)]'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2 truncate">
                                            <button
                                              onClick={(e) => toggleNodeCompletion(sub.id, e)}
                                              className="hover:scale-110 transition-transform cursor-pointer shrink-0"
                                            >
                                              {isSubCompleted ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                              ) : (
                                                <Circle className="w-4 h-4 text-[var(--text-secondary)] hover:text-emerald-400 transition-colors" />
                                              )}
                                            </button>
                                            <span className={`truncate font-medium ${isSubCompleted ? 'line-through opacity-70' : ''}`}>
                                              {sub.title}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Panel: Selected Roadmap Node Detail Inspector */}
            <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-[var(--border-subtle)] bg-[var(--glass-bg)]/40 p-4 space-y-4 overflow-y-auto">
              {selectedRoadmapItem ? (
                <div className="space-y-4 animate-fade-in text-[var(--text-primary)]">
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                    <div className="flex items-center gap-2 text-[var(--accent-primary)]">
                      <Compass className="w-4 h-4" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                        Roadmap Inspector
                      </h4>
                    </div>
                    <button
                      onClick={(e) => toggleNodeCompletion(selectedRoadmapItem.id, e)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                        completedNodeIds.has(selectedRoadmapItem.id)
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                          : 'bg-[var(--accent-primary-soft)] border-[var(--border-subtle)] text-[var(--accent-primary)]'
                      }`}
                    >
                      <CheckCircle2 size={12} />
                      <span>{completedNodeIds.has(selectedRoadmapItem.id) ? 'Completed' : 'Mark Done'}</span>
                    </button>
                  </div>

                  <div>
                    <span className="text-[9px] font-mono text-[var(--text-secondary)] block mb-1">
                      {selectedRoadmapItem.phaseTitle || 'Roadmap Module'}
                    </span>
                    <h3 className="text-sm font-bold text-[var(--text-primary)] leading-snug">
                      {selectedRoadmapItem.title}
                    </h3>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] leading-relaxed space-y-2">
                    <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                      Module Concept Breakdown
                    </span>
                    <p>{selectedRoadmapItem.summary}</p>
                  </div>

                  {selectedRoadmapItem.project && (
                    <div className="p-3.5 rounded-xl bg-[var(--accent-primary-soft)] border border-[var(--border-subtle)] text-xs space-y-1.5">
                      <span className="text-[10px] font-extrabold uppercase text-[var(--accent-primary)] tracking-wider flex items-center gap-1">
                        🎯 Milestone Hands-On Task
                      </span>
                      <p className="font-bold text-[var(--text-primary)] leading-snug">{selectedRoadmapItem.project}</p>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      onClick={() => alert(`Asking AI Tutor about '${selectedRoadmapItem.title}'...`)}
                      className="w-full py-2 px-3 rounded-xl bg-[var(--accent-primary)] text-[var(--text-inverse)] text-xs font-bold flex items-center justify-center gap-2 shadow hover:opacity-90 transition-all cursor-pointer"
                    >
                      <Sparkles size={14} />
                      <span>Ask AI Tutor About This Node</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-[var(--text-secondary)]">
                  <Info className="w-6 h-6 text-[var(--accent-primary)]" />
                  <p className="text-xs font-medium">Click on any node in the roadmap tree to view deep concept breakdown & project details.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* 3D GRAPHICAL CANVAS UNIVERSE VIEW */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
            {/* Left/Center: Interactive 3D Canvas Universe */}
            <div className="flex-1 bg-[#0B0F19] relative flex items-center justify-center overflow-hidden">
              <canvas
                ref={canvasRef}
                width={800}
                height={550}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onContextMenu={(e) => e.preventDefault()}
                onClick={handleCanvasClick}
                onWheel={(e) => {
                  e.preventDefault();
                  const delta = e.deltaY < 0 ? 0.08 : -0.08;
                  setZoomLevel((z) => Math.max(0.2, Math.min(3.5, z + delta)));
                }}
                className="w-full h-full cursor-grab active:cursor-grabbing select-none"
              />

              {/* Top-Right 3D Interactive Controls Overlay */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-[var(--card-bg)]/80 backdrop-blur-md border border-[var(--border-subtle)] p-1.5 rounded-xl shadow-lg z-10">
                <button
                  onClick={() => setZoomLevel((z) => Math.min(3.5, z + 0.15))}
                  className="p-1.5 rounded-lg hover:bg-[var(--glass-bg)] text-[var(--text-primary)] transition-colors cursor-pointer"
                  title="Zoom In (Z-Axis)"
                >
                  <ZoomIn size={15} />
                </button>
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.2, z - 0.15))}
                  className="p-1.5 rounded-lg hover:bg-[var(--glass-bg)] text-[var(--text-primary)] transition-colors cursor-pointer"
                  title="Zoom Out (Z-Axis)"
                >
                  <ZoomOut size={15} />
                </button>
                <div className="w-[1px] h-4 bg-[var(--border-subtle)] mx-0.5" />
                <button
                  onClick={handleReset3DView}
                  className="p-1.5 rounded-lg hover:bg-[var(--glass-bg)] text-[var(--text-primary)] transition-colors cursor-pointer"
                  title="Reset 3D X/Y/Z View"
                >
                  <RotateCcw size={15} />
                </button>
                <button
                  onClick={() => setAutoRotate(!autoRotate)}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    autoRotate ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-bold' : 'hover:bg-[var(--glass-bg)] text-[var(--text-secondary)]'
                  }`}
                  title="Toggle 3D Orbit Auto-Rotate"
                >
                  {autoRotate ? <Pause size={15} /> : <Play size={15} />}
                </button>
              </div>

              {/* Bottom-Left Motion Helper Badge */}
              <div className="absolute bottom-3 left-3 bg-[#0F172A]/85 backdrop-blur-md border border-slate-700/80 rounded-xl px-3 py-1.5 text-[9.5px] font-mono text-slate-300 pointer-events-none shadow-xl flex items-center gap-2">
                <Compass className="w-3.5 h-3.5 text-sky-400 animate-spin-slow" />
                <span>Left-drag: Rotate X/Y | Right-drag / Shift-drag: Pan X/Y | Scroll: Zoom Z</span>
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
        )}
      </div>
    </div>,
    document.body
  );
};
