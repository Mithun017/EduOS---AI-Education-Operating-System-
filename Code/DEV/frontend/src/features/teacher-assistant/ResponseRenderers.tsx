import React, { useState } from 'react';
import { BookOpen, Lightbulb, MapPin, BarChart3, HelpCircle, FileText, CheckCircle2, ChevronRight, History } from 'lucide-react';

// ============================================================================
// 1. EXPLANATION CARD
// ============================================================================
export interface ExplanationData {
  summary: string;
  real_world_example: string;
  key_points: string[];
}

export const ExplanationCard: React.FC<{ data: ExplanationData }> = ({ data }) => {
  return (
    <div className="glass-panel-interactive p-6 space-y-4 animate-slide-up">
      <div className="flex items-center gap-3 text-indigo-400 border-b border-slate-800/80 pb-3">
        <BookOpen className="w-5 h-5 animate-pulse" />
        <h4 className="font-semibold text-lg text-slate-100">Grounded Explanation</h4>
      </div>
      
      <p className="text-slate-300 leading-relaxed text-sm">{data.summary}</p>
      
      {data.real_world_example && (
        <div className="bg-indigo-950/40 border-l-4 border-indigo-500 p-4 rounded-r-xl space-y-2">
          <div className="flex items-center gap-2 text-indigo-300 font-medium text-xs uppercase tracking-wider">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            Real-world Example
          </div>
          <p className="text-slate-300 text-sm italic">{data.real_world_example}</p>
        </div>
      )}
      
      {data.key_points && data.key_points.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Key Concepts</span>
          <div className="flex flex-wrap gap-2">
            {data.key_points.map((pt, idx) => (
              <span key={idx} className="bg-slate-800/60 border border-slate-700/50 text-slate-300 text-xs px-3 py-1 rounded-full flex items-center gap-1.5 hover:border-indigo-500/40 transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                {pt}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. ROADMAP DIAGRAM (Pure SVG, Interactive, Premium Flowchart)
// ============================================================================
export interface RoadmapNode {
  id: string;
  label: string;
  order: number;
}
export interface RoadmapEdge {
  from: string;
  to: string;
}
export interface RoadmapData {
  nodes: RoadmapNode[];
  edges: RoadmapEdge[];
}

export const RoadmapDiagram: React.FC<{ data: RoadmapData }> = ({ data }) => {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Compute node coordinate positions automatically
  const boxWidth = 140;
  const boxHeight = 50;
  const colWidth = 180;
  const rowHeight = 90;
  const startX = 40;
  const startY = 40;

  // Let's compute positions: simple sequential layout
  const nodesWithPositions = data.nodes
    .sort((a, b) => a.order - b.order)
    .map((node, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      return {
        ...node,
        x: startX + col * colWidth,
        y: startY + row * rowHeight,
      };
    });

  const nodeMap = new Map(nodesWithPositions.map((n) => [n.id, n]));

  return (
    <div className="glass-panel-interactive p-6 space-y-4 animate-slide-up">
      <div className="flex items-center gap-3 text-emerald-400 border-b border-slate-800/80 pb-3">
        <MapPin className="w-5 h-5" />
        <h4 className="font-semibold text-lg text-slate-100">Topic Roadmap & Learning Path</h4>
      </div>

      <div className="w-full overflow-x-auto bg-slate-950/50 p-4 rounded-xl border border-slate-800/60">
        <svg viewBox="0 0 600 240" className="w-full min-w-[500px] h-auto">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 10 5 L 0 8.5 z" className="fill-slate-600" />
            </marker>
            <marker id="arrow-active" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 10 5 L 0 8.5 z" className="fill-emerald-500" />
            </marker>
          </defs>

          {/* Render connecting edges */}
          {data.edges.map((edge, idx) => {
            const fromNode = nodeMap.get(edge.from);
            const toNode = nodeMap.get(edge.to);
            if (!fromNode || !toNode) return null;

            const fromX = fromNode.x + boxWidth / 2;
            const fromY = fromNode.y + boxHeight / 2;
            const toX = toNode.x + boxWidth / 2;
            const toY = toNode.y + boxHeight / 2;

            // Offset to avoid intersecting the boxes directly
            const angle = Math.atan2(toY - fromY, toX - fromX);
            const dx = Math.cos(angle) * (boxWidth / 2 + 5);
            const dy = Math.sin(angle) * (boxHeight / 2 + 5);

            const startPtX = fromX + dx;
            const startPtY = fromY + dy;
            const endPtX = toX - dx;
            const endPtY = toY - dy;

            const isActive = selectedNode === edge.from || selectedNode === edge.to;

            return (
              <line
                key={idx}
                x1={startPtX}
                y1={startPtY}
                x2={endPtX}
                y2={endPtY}
                className={`stroke-2 transition-all duration-300 ${
                  isActive ? 'stroke-emerald-400' : 'stroke-slate-700/60'
                }`}
                markerEnd={isActive ? 'url(#arrow-active)' : 'url(#arrow)'}
              />
            );
          })}

          {/* Render node boxes */}
          {nodesWithPositions.map((node) => {
            const isSelected = selectedNode === node.id;
            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => setSelectedNode(node.id === selectedNode ? null : node.id)}
                className="roadmap-node"
              >
                <rect
                  width={boxWidth}
                  height={boxHeight}
                  rx={8}
                  className={`transition-colors duration-300 stroke-2 cursor-pointer ${
                    isSelected 
                      ? 'fill-emerald-950/70 stroke-emerald-400' 
                      : 'fill-slate-900/90 stroke-slate-800 hover:stroke-slate-600'
                  }`}
                />
                <text
                  x={boxWidth / 2}
                  y={boxHeight / 2 + 4}
                  textAnchor="middle"
                  className={`text-[11px] font-medium cursor-pointer fill-slate-100`}
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-slate-400 text-xs italic">💡 Click on any node to highlight its paths.</p>
    </div>
  );
};

// ============================================================================
// 3. CHART CARD (SVG Charting)
// ============================================================================
export interface ChartData {
  chart_type: 'bar' | 'line';
  labels: string[];
  series: number[];
}

export const ChartCard: React.FC<{ data: ChartData }> = ({ data }) => {
  const maxValue = Math.max(...data.series, 10);
  const chartHeight = 120;
  const padding = 20;

  return (
    <div className="glass-panel-interactive p-6 space-y-4 animate-slide-up">
      <div className="flex items-center gap-3 text-amber-400 border-b border-slate-800/80 pb-3">
        <BarChart3 className="w-5 h-5" />
        <h4 className="font-semibold text-lg text-slate-100">Topic Analysis Chart</h4>
      </div>

      <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/60">
        {data.chart_type === 'bar' ? (
          <div className="flex items-end justify-between h-[150px] px-4 pt-4 border-b border-slate-800">
            {data.series.map((val, idx) => {
              const heightPercent = (val / maxValue) * 100;
              return (
                <div key={idx} className="flex flex-col items-center flex-1 group">
                  <span className="text-[10px] text-slate-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {val}
                  </span>
                  <div 
                    style={{ height: `${heightPercent}%` }}
                    className="w-8 max-w-full rounded-t bg-gradient-to-t from-amber-600 to-amber-400 group-hover:from-amber-500 group-hover:to-amber-300 transition-all duration-300 shadow-md shadow-amber-950/30"
                  />
                  <span className="text-[10px] text-slate-400 mt-2 truncate w-12 text-center">
                    {data.labels[idx]}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          /* Custom SVG Line Chart */
          <div className="relative pt-4">
            <svg viewBox="0 0 300 120" className="w-full h-[120px]">
              {/* Draw grid lines */}
              <line x1="0" y1="20" x2="300" y2="20" className="stroke-slate-800/50 stroke-1" />
              <line x1="0" y1="60" x2="300" y2="60" className="stroke-slate-800/50 stroke-1" />
              <line x1="0" y1="100" x2="300" y2="100" className="stroke-slate-800 stroke-1" />

              {/* Draw chart path */}
              <path
                d={data.series
                  .map((val, idx) => {
                    const x = (idx / (data.series.length - 1)) * 300;
                    const y = chartHeight - padding - (val / maxValue) * (chartHeight - 2 * padding);
                    return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                  })
                  .join(' ')}
                className="fill-none stroke-amber-400 stroke-2"
              />

              {/* Draw dots */}
              {data.series.map((val, idx) => {
                const x = (idx / (data.series.length - 1)) * 300;
                const y = chartHeight - padding - (val / maxValue) * (chartHeight - 2 * padding);
                return (
                  <g key={idx} className="group cursor-pointer">
                    <circle cx={x} cy={y} r="4" className="fill-slate-950 stroke-amber-400 stroke-2" />
                    <circle cx={x} cy={y} r="8" className="fill-amber-400/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </g>
                );
              })}
            </svg>
            <div className="flex justify-between mt-2 px-1">
              {data.labels.map((lbl, idx) => (
                <span key={idx} className="text-[9px] text-slate-400">{lbl}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 4. KEY POINTS LIST
// ============================================================================
export interface KeyPointsData {
  points: string[];
}

export const KeyPointsList: React.FC<{ data: KeyPointsData }> = ({ data }) => {
  return (
    <div className="glass-panel-interactive p-6 space-y-4 animate-slide-up">
      <div className="flex items-center gap-3 text-brand-400 border-b border-slate-800/80 pb-3">
        <CheckCircle2 className="w-5 h-5" />
        <h4 className="font-semibold text-lg text-slate-100">Key Points Summary</h4>
      </div>

      <ul className="space-y-3">
        {data.points.map((pt, idx) => (
          <li key={idx} className="flex gap-3 text-slate-300 text-sm leading-relaxed group">
            <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-brand-950/40 text-brand-400 group-hover:bg-brand-500/10 transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
            {pt}
          </li>
        ))}
      </ul>
    </div>
  );
};

// ============================================================================
// 5. RESOURCE LIST
// ============================================================================
export interface ResourceItem {
  title: string;
  type: string; // notes, ppt, pdf, youtube, web
  url_or_ref: string;
}
export interface ResourceData {
  resources: ResourceItem[];
}

export const ResourceList: React.FC<{ data: ResourceData }> = ({ data }) => {
  return (
    <div className="glass-panel-interactive p-6 space-y-4 animate-slide-up">
      <div className="flex items-center gap-3 text-blue-400 border-b border-slate-800/80 pb-3">
        <FileText className="w-5 h-5" />
        <h4 className="font-semibold text-lg text-slate-100">Academic & External Resources</h4>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.resources.map((res, idx) => (
          <a
            key={idx}
            href="#"
            onClick={(e) => e.preventDefault()}
            className="flex items-start gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800/60 hover:border-blue-500/30 hover:bg-slate-800/40 transition-all group"
          >
            <div className="p-2 rounded bg-blue-950/60 text-blue-400 group-hover:text-blue-300 transition-colors">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h5 className="text-xs font-semibold text-slate-200 group-hover:text-slate-100 transition-colors truncate max-w-[180px]">
                {res.title}
              </h5>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mt-0.5">
                {res.type}
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 6. QUICK QUESTION CARD (interactive show/hide hint)
// ============================================================================
export interface QuickQuestionData {
  question: string;
  expected_answer_hint: string;
}

export const QuickQuestionCard: React.FC<{ data: QuickQuestionData }> = ({ data }) => {
  const [showHint, setShowHint] = useState(false);

  return (
    <div className="glass-panel-interactive p-6 space-y-4 animate-slide-up">
      <div className="flex items-center gap-3 text-purple-400 border-b border-slate-800/80 pb-3">
        <HelpCircle className="w-5 h-5" />
        <h4 className="font-semibold text-lg text-slate-100">Live Class Question</h4>
      </div>

      <div className="space-y-3">
        <p className="text-slate-200 text-sm font-medium leading-relaxed bg-slate-950/30 p-4 rounded-xl border border-slate-800/30">
          "{data.question}"
        </p>

        <div className="flex flex-col items-center">
          <button
            onClick={() => setShowHint(!showHint)}
            className="px-4 py-1.5 text-xs rounded-lg font-medium bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 hover:text-slate-200 transition-colors flex items-center gap-1.5"
          >
            {showHint ? "Hide Answer Hint" : "Show Expected Answer Hint"}
          </button>

          {showHint && (
            <div className="mt-3 w-full bg-purple-950/20 border border-purple-500/20 p-4 rounded-xl text-xs text-purple-300 leading-relaxed animate-fade-in">
              <span className="font-bold block mb-1">Expected Concept Hint:</span>
              {data.expected_answer_hint}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 7. PREVIOUS QUESTION TIMELINE
// ============================================================================
export interface PriorQuestion {
  question: string;
  answer_summary: string;
  date: string;
}
export interface PriorQuestionData {
  prior_questions: PriorQuestion[];
}

export const PreviousQuestionCard: React.FC<{ data: PriorQuestionData }> = ({ data }) => {
  return (
    <div className="glass-panel-interactive p-6 space-y-4 animate-slide-up">
      <div className="flex items-center gap-3 text-slate-300 border-b border-slate-800/80 pb-3">
        <History className="w-5 h-5" />
        <h4 className="font-semibold text-lg text-slate-100">Previous Classroom History</h4>
      </div>

      <div className="relative border-l border-slate-800 pl-4 space-y-5 py-1">
        {data.prior_questions.map((pq, idx) => (
          <div key={idx} className="relative space-y-1">
            <span className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full bg-slate-800 border border-slate-600" />
            <div className="flex justify-between items-baseline">
              <h5 className="text-xs font-semibold text-slate-200 leading-relaxed max-w-[80%]">"{pq.question}"</h5>
              <span className="text-[9px] text-slate-500">{pq.date}</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed italic bg-slate-900/30 p-2 rounded-lg border border-slate-800/30">
              {pq.answer_summary}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
