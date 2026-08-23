import React, { useState, useEffect } from 'react';
import { X, Network, Sparkles, RefreshCw, Search, ArrowRight, BookOpen, Info } from 'lucide-react';
import { useEduOSStore } from '../../store/store';
import { askTeacherHTTP } from '../../lib/api';

interface GraphNode {
  id: string;
  label: string;
  type: 'core' | 'subconcept' | 'component' | 'formula';
  summary: string;
  x: number;
  y: number;
}

interface GraphEdge {
  from: string;
  to: string;
  relation: string;
}

interface GraphData {
  topic: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
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
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Generate Graph Data dynamically for topic
  const generateGraphForTopic = async (topicName: string) => {
    setIsGenerating(true);
    setSelectedNode(null);

    try {
      // Try to query real AI orchestrator for graph breakdown
      const promptText = `Provide a structured concept graph for topic "${topicName}".`;
      const response = await askTeacherHTTP(
        promptText,
        'hybrid',
        user?.token || '',
        user?.institutionId || 'demo-inst-001'
      );

      // Construct interactive radial/orbital nodes around core topic
      const coreId = 'core-node';
      const nodes: GraphNode[] = [
        {
          id: coreId,
          label: topicName,
          type: 'core',
          summary: response?.summary || `Core central topic analysis for ${topicName}. Represents main educational domain.`,
          x: 350,
          y: 200,
        },
      ];

      // Define default sub-concepts dynamically tailored to topic
      const subConcepts = response?.key_points && response.key_points.length > 0
        ? response.key_points.slice(0, 6)
        : [
            `${topicName} Fundamentals`,
            `Key Mathematical Formulations`,
            `Architectural Components`,
            `Real-world Applications`,
            `Optimization & Loss Functions`,
            `Advanced Hyperparameters`
          ];

      const edges: GraphEdge[] = [];
      const radius = 160;
      const angleStep = (2 * Math.PI) / subConcepts.length;

      subConcepts.forEach((subName: string, idx: number) => {
        const nodeId = `sub-node-${idx}`;
        const angle = idx * angleStep - Math.PI / 2;
        const x = 350 + radius * Math.cos(angle);
        const y = 200 + radius * Math.sin(angle);

        nodes.push({
          id: nodeId,
          label: subName,
          type: idx % 2 === 0 ? 'subconcept' : 'component',
          summary: `Sub-analysis node for "${subName}". Explores foundational mechanics, formulas, and operational dependencies related to ${topicName}.`,
          x: Math.round(x),
          y: Math.round(y),
        });

        edges.push({
          from: coreId,
          to: nodeId,
          relation: idx % 2 === 0 ? 'defines' : 'operates_via',
        });
      });

      // Add inter-subconcept cross edge for second brain connectivity
      if (nodes.length > 3) {
        edges.push({
          from: nodes[1].id,
          to: nodes[2].id,
          relation: 'depends_on',
        });
      }

      setGraphData({
        topic: topicName,
        nodes,
        edges,
      });
      setSelectedNode(nodes[0]);
    } catch (err) {
      console.warn("Generating fallback knowledge graph locally.", err);
      // Fallback radial graph generator
      const coreId = 'core-node';
      const fallbackNodes: GraphNode[] = [
        {
          id: coreId,
          label: topicName,
          type: 'core',
          summary: `Core analysis node for ${topicName}. Represents primary curriculum focus.`,
          x: 350,
          y: 200,
        },
        {
          id: 'sub-1',
          label: 'Spatial Feature Map',
          type: 'subconcept',
          summary: '2D matrix representations extracted through convolution kernels.',
          x: 210,
          y: 110,
        },
        {
          id: 'sub-2',
          label: 'Pooling & Subsampling',
          type: 'component',
          summary: 'Reduces spatial dimensionality while retaining maximum/average feature signals.',
          x: 490,
          y: 110,
        },
        {
          id: 'sub-3',
          label: 'Backpropagation Gradient',
          type: 'formula',
          summary: 'Mathematical chain-rule derivative calculation for filter weight updates.',
          x: 490,
          y: 290,
        },
        {
          id: 'sub-4',
          label: 'Softmax Classification',
          type: 'subconcept',
          summary: 'Normalizes raw logit outputs into target class probability distribution.',
          x: 210,
          y: 290,
        },
      ];

      const fallbackEdges: GraphEdge[] = [
        { from: coreId, to: 'sub-1', relation: 'extracts' },
        { from: coreId, to: 'sub-2', relation: 'downsamples' },
        { from: coreId, to: 'sub-3', relation: 'optimizes' },
        { from: coreId, to: 'sub-4', relation: 'classifies' },
        { from: 'sub-1', to: 'sub-2', relation: 'feeds_into' },
      ];

      setGraphData({
        topic: topicName,
        nodes: fallbackNodes,
        edges: fallbackEdges,
      });
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-lg animate-fade-in">
      <div className="w-full max-w-5xl h-[85vh] bg-[var(--card-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl flex flex-col overflow-hidden glass-panel">
        {/* Header Bar */}
        <div className="px-5 py-3 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 bg-[var(--glass-bg)]/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border border-[var(--border-subtle)]">
              <Network className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[var(--text-primary)] flex items-center gap-2">
                Second Brain — Knowledge Graph
                <span className="text-[9px] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-mono font-bold px-2 py-0.5 rounded-full border border-[var(--border-subtle)] uppercase">
                  Real-time Graph Engine
                </span>
              </h3>
              <p className="text-[10px] text-[var(--text-secondary)]">
                AI-curated nodes & edges concept map for deep analysis
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

        {/* Topic Input Search Bar */}
        <div className="p-3 bg-[var(--glass-bg)]/40 border-b border-[var(--border-subtle)] flex items-center gap-2">
          <div className="flex-1 relative flex items-center">
            <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3" />
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && generateGraphForTopic(topicInput)}
              placeholder="Enter any topic to construct Second Brain Graph (e.g., Quantum Computing, Backpropagation)..."
              className="w-full bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-xl pl-9 pr-4 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>
          <button
            onClick={() => generateGraphForTopic(topicInput)}
            disabled={isGenerating || !topicInput.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent-primary)] text-[var(--text-inverse)] rounded-xl text-xs font-bold shadow hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Analyze Topic</span>
              </>
            )}
          </button>
        </div>

        {/* Main Graph & Detail Workspace */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          {/* Left/Center: Interactive SVG Knowledge Graph */}
          <div className="flex-1 bg-[var(--bg-app)] relative flex items-center justify-center overflow-hidden p-4">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="w-10 h-10 border-4 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono text-[var(--text-secondary)]">Generating Knowledge Nodes & Edges...</span>
              </div>
            ) : graphData ? (
              <svg viewBox="0 0 700 400" className="w-full h-full max-h-[500px]">
                <defs>
                  <marker
                    id="edge-arrow"
                    viewBox="0 0 10 10"
                    refX="22"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="var(--accent-primary)" />
                  </marker>
                  <filter id="node-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Render Edges (Connecting Lines & Relation Badges) */}
                {graphData.edges.map((edge, idx) => {
                  const fromNode = graphData.nodes.find((n) => n.id === edge.from);
                  const toNode = graphData.nodes.find((n) => n.id === edge.to);
                  if (!fromNode || !toNode) return null;

                  const isConnectedToSelected =
                    selectedNode && (selectedNode.id === edge.from || selectedNode.id === edge.to);

                  const midX = (fromNode.x + toNode.x) / 2;
                  const midY = (fromNode.y + toNode.y) / 2;

                  return (
                    <g key={idx}>
                      <line
                        x1={fromNode.x}
                        y1={fromNode.y}
                        x2={toNode.x}
                        y2={toNode.y}
                        stroke={isConnectedToSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}
                        strokeWidth={isConnectedToSelected ? 3 : 1.5}
                        strokeDasharray={edge.relation === 'depends_on' ? '4 4' : undefined}
                        markerEnd="url(#edge-arrow)"
                        className="transition-all duration-300"
                      />
                      <rect
                        x={midX - 35}
                        y={midY - 9}
                        width="70"
                        height="18"
                        rx="4"
                        fill="var(--card-bg)"
                        stroke="var(--border-subtle)"
                        strokeWidth="1"
                      />
                      <text
                        x={midX}
                        y={midY + 3}
                        textAnchor="middle"
                        fill="var(--text-secondary)"
                        className="text-[8px] font-mono"
                      >
                        {edge.relation}
                      </text>
                    </g>
                  );
                })}

                {/* Render Nodes */}
                {graphData.nodes.map((node) => {
                  const isSelected = selectedNode?.id === node.id;
                  const isCore = node.type === 'core';
                  const radius = isCore ? 34 : 24;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={() => setSelectedNode(node)}
                      className="cursor-pointer group"
                    >
                      {/* Glow Ring */}
                      <circle
                        r={radius + 6}
                        fill={isCore ? 'var(--accent-primary)' : 'var(--glass-bg)'}
                        opacity={isSelected ? 0.35 : 0.1}
                        className="transition-all duration-300 group-hover:opacity-40"
                      />

                      {/* Main Node Circle */}
                      <circle
                        r={radius}
                        fill={isCore ? 'var(--accent-primary)' : isSelected ? 'var(--accent-primary-soft)' : 'var(--glass-bg)'}
                        stroke={isSelected || isCore ? 'var(--accent-primary)' : 'var(--border-subtle)'}
                        strokeWidth={isCore ? 3 : 2}
                        filter={isSelected ? 'url(#node-glow)' : undefined}
                        className="transition-all duration-300"
                      />

                      {/* Node Icon/Text */}
                      <text
                        y={4}
                        textAnchor="middle"
                        fill={isCore ? 'var(--text-inverse)' : 'var(--text-primary)'}
                        className={`font-bold select-none ${isCore ? 'text-[10px]' : 'text-[9px]'}`}
                      >
                        {node.label.length > 18 ? `${node.label.substring(0, 16)}...` : node.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            ) : null}
          </div>

          {/* Right Panel: Selected Node Deep Analysis & Details */}
          <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-[var(--border-subtle)] bg-[var(--glass-bg)]/40 p-4 space-y-4 overflow-y-auto">
            {selectedNode ? (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2 text-[var(--accent-primary)]">
                  <BookOpen className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    {selectedNode.type === 'core' ? 'Central Concept' : 'Sub-Concept Node'}
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
                    AI Concept Analysis
                  </span>
                  <p>{selectedNode.summary}</p>
                </div>

                {/* Connected Edges List */}
                {graphData && (
                  <div className="space-y-1.5 pt-2 border-t border-[var(--border-subtle)]">
                    <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                      Connected Network Links
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
                <p className="text-xs font-medium">Click on any node in the Second Brain Graph to inspect deep analysis details.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
