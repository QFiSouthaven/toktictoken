
import React, { useMemo, useState } from 'react';
import { Message, Agent } from '../types';
import { Activity, AlertCircle, DoorOpen, Lock, Mic, Hourglass } from 'lucide-react';

interface SwarmTimelineProps {
  messages: Message[];
  agents: Agent[];
  onMessageClick: (messageId: string) => void;
  isSwarmActive?: boolean;
  isProcessing?: boolean;
}

const SwarmTimeline: React.FC<SwarmTimelineProps> = ({ 
    messages, 
    agents, 
    onMessageClick,
    isSwarmActive = false,
    isProcessing = false
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // 1. Calculate Agent States for the "Swinging Door" visualization
  const agentStates = useMemo(() => {
    return agents.map(agent => {
        // Find the index of the last message sent by this agent
        let lastMsgIndex = -1;
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].agentId === agent.id) {
                lastMsgIndex = i;
                break;
            }
        }

        const hasSpoken = lastMsgIndex !== -1;
        const turnsSinceSpeaking = hasSpoken ? (messages.length - 1) - lastMsgIndex : Infinity;

        // Determine Status
        let status: 'active' | 'cooldown' | 'ready' = 'ready';
        let cooldownPercent = 100;

        if (hasSpoken) {
            if (turnsSinceSpeaking === 0) {
                status = 'active';
            } else if (turnsSinceSpeaking < 3) {
                status = 'cooldown';
                // 1 turn ago = 33% recovered, 2 turns ago = 66% recovered
                cooldownPercent = (turnsSinceSpeaking / 3) * 100;
            }
        }

        return {
            ...agent,
            status,
            cooldownPercent,
            lastMsgId: hasSpoken ? messages[lastMsgIndex].id : null
        };
    });
  }, [agents, messages]);

  // 2. Calculate Metrics based on heuristics for the graph
  const dataPoints = useMemo(() => {
    return messages.map((msg, index) => {
      const agent = agents.find(a => a.id === msg.agentId);
      const prevMsg = messages[index - 1];
      
      // Heuristic 1: Impact (Cyan) - Based on content length, source usage, and tool usage
      let impactScore = Math.min((msg.content.length / 500) * 100, 100);
      if (msg.sources?.length) impactScore = Math.min(impactScore + 20, 100);
      if (msg.isThinking) impactScore = Math.min(impactScore + 10, 100);

      // Heuristic 2: Sequential Flow (Purple) - Time delta and turn-taking logic
      let flowScore = 80;
      if (prevMsg) {
        const timeDiff = msg.timestamp - prevMsg.timestamp;
        // Penalize if too fast (spamming) or too slow (lag)
        if (timeDiff < 1000) flowScore -= 20; 
        if (timeDiff > 60000) flowScore -= 10;
        // Bonus for alternating speakers
        if (prevMsg.agentId !== msg.agentId) flowScore += 10;
      }

      // Heuristic 3: Consistency (Orange) - Role adherence proxy (length vs system instruction)
      let consistencyScore = 90;
      if (agent) {
         // Simple heuristic: Does the response length vaguely match the instruction complexity?
         const complexityRatio = msg.content.length / (agent.systemInstruction.length || 1);
         if (complexityRatio < 0.1) consistencyScore -= 30; // Too short for role?
      } else {
          // User messages are always consistent with themselves
          consistencyScore = 100;
      }

      return {
        id: msg.id,
        agentName: agent ? agent.name : 'User',
        agentColor: agent ? agent.color : '#3b82f6',
        impact: Math.max(10, Math.min(100, impactScore)),
        flow: Math.max(10, Math.min(100, flowScore)),
        consistency: Math.max(10, Math.min(100, consistencyScore)),
        contentSnippet: msg.content.substring(0, 80) + (msg.content.length > 80 ? '...' : '')
      };
    });
  }, [messages, agents]);

  // Dimensions for Graph
  const height = 140;
  const widthPerPoint = 70; // Increased spacing for better tooltips
  const totalWidth = Math.max(dataPoints.length * widthPerPoint, 200); // Ensure min width
  const padding = 30;

  // Helper to create path string
  const createPath = (key: 'impact' | 'flow' | 'consistency') => {
    return dataPoints.map((pt, i) => {
      const x = padding + i * widthPerPoint;
      const y = height - (pt[key] / 100) * (height - 40) - 20;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  return (
    <div className="w-full bg-gray-900 border-t border-gray-800 p-3 select-none flex flex-col gap-4">
      
      {/* --- SWINGING DOOR MECHANISM VISUALIZATION --- */}
      {isSwarmActive && (
          <div className="bg-gray-950/50 rounded-xl border border-gray-800 p-3 flex flex-col gap-2">
            <div className="flex justify-between items-center px-1">
                 <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <DoorOpen className="w-4 h-4 text-emerald-400" />
                    Swinging Door Status
                 </h3>
                 <span className="text-[10px] text-emerald-400 animate-pulse font-mono">
                    {isProcessing ? "ARBITRATING..." : "ACTIVE"}
                 </span>
            </div>
            
            <div className="flex items-center gap-4 overflow-x-auto pb-2 custom-scrollbar">
                {agentStates.map((agentState) => {
                    const isActive = agentState.status === 'active';
                    const isCooldown = agentState.status === 'cooldown';
                    
                    return (
                        <div 
                            key={agentState.id}
                            className={`flex flex-col items-center gap-1.5 min-w-[80px] transition-all duration-300 ${
                                isActive ? 'scale-105 opacity-100' : isCooldown ? 'opacity-50 scale-95' : 'opacity-70'
                            }`}
                        >
                            <div className="relative">
                                {/* Avatar */}
                                <img 
                                    src={agentState.avatar} 
                                    alt={agentState.name} 
                                    className={`w-10 h-10 rounded-lg object-cover border-2 transition-colors ${
                                        isActive ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 
                                        isCooldown ? 'border-red-900 grayscale' : 'border-gray-700'
                                    }`} 
                                />
                                
                                {/* Status Icon Overlay */}
                                <div className={`absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center border-2 border-gray-900 ${
                                    isActive ? 'bg-emerald-500 text-white' : 
                                    isCooldown ? 'bg-gray-800 text-red-400' : 'bg-gray-800 text-gray-400'
                                }`}>
                                    {isActive ? <Mic className="w-3 h-3" /> : 
                                     isCooldown ? <Hourglass className="w-3 h-3" /> : 
                                     <div className="w-1.5 h-1.5 rounded-full bg-gray-500"></div>}
                                </div>
                            </div>
                            
                            {/* Name & Bar */}
                            <div className="flex flex-col items-center w-full gap-1">
                                <span className={`text-[9px] font-bold truncate max-w-full ${isActive ? 'text-emerald-400' : 'text-gray-500'}`}>
                                    {agentState.name.split(' ')[0]}
                                </span>
                                
                                {/* Cooldown Bar */}
                                {isCooldown && (
                                    <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-red-500 transition-all duration-500"
                                            style={{ width: `${agentState.cooldownPercent}%` }}
                                        ></div>
                                    </div>
                                )}
                                {isActive && (
                                     <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 animate-progress-indeterminate"></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
          </div>
      )}

      {/* --- TIMELINE GRAPH --- */}
      <div>
        <div className="flex justify-between items-center mb-2 px-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Impact Timeline
            </h3>
            <div className="flex gap-4 text-[10px] font-mono">
            <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]"></div>
                <span className="text-cyan-400">Impact</span>
            </div>
            <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.6)]"></div>
                <span className="text-purple-400">Flow</span>
            </div>
            <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.6)]"></div>
                <span className="text-orange-400">Consistency</span>
            </div>
            </div>
        </div>

        {dataPoints.length > 0 ? (
            <div className="relative w-full overflow-x-auto custom-scrollbar h-[140px] bg-gray-950/50 rounded-lg border border-gray-800/50">
                <svg 
                width={totalWidth + padding * 2} 
                height={height} 
                className="absolute top-0 left-0"
                style={{ minWidth: '100%' }}
                >
                {/* Grid Lines */}
                <line x1="0" y1={height * 0.25} x2="100%" y2={height * 0.25} stroke="#1f2937" strokeWidth="1" strokeDasharray="4" />
                <line x1="0" y1={height * 0.5} x2="100%" y2={height * 0.5} stroke="#1f2937" strokeWidth="1" strokeDasharray="4" />
                <line x1="0" y1={height * 0.75} x2="100%" y2={height * 0.75} stroke="#1f2937" strokeWidth="1" strokeDasharray="4" />

                {/* Paths */}
                <path d={createPath('impact')} fill="none" stroke="#22d3ee" strokeWidth="2" className="drop-shadow-[0_0_2px_rgba(34,211,238,0.5)]" />
                <path d={createPath('flow')} fill="none" stroke="#c084fc" strokeWidth="2" className="drop-shadow-[0_0_2px_rgba(192,132,252,0.5)]" />
                <path d={createPath('consistency')} fill="none" stroke="#fb923c" strokeWidth="2" className="drop-shadow-[0_0_2px_rgba(251,146,60,0.5)]" />

                {/* Interactive Nodes */}
                {dataPoints.map((pt, i) => {
                    const x = padding + i * widthPerPoint;
                    const yImpact = height - (pt.impact / 100) * (height - 40) - 20;
                    const isMisaligned = pt.consistency < 40 || pt.flow < 40;

                    // Tooltip positioning calculations
                    const tooltipWidth = 200;
                    // Flip tooltip to left if closer to right edge
                    const flipLeft = x + tooltipWidth + 20 > totalWidth + padding;
                    const tooltipX = flipLeft ? x - tooltipWidth - 10 : x + 10;
                    // Ensure tooltip doesn't go below bottom
                    const tooltipY = 10; 

                    return (
                    <g 
                        key={pt.id} 
                        onClick={() => onMessageClick(pt.id)}
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        className="cursor-pointer group transition-opacity duration-200"
                        style={{ opacity: hoveredIndex !== null && hoveredIndex !== i ? 0.4 : 1 }}
                    >
                        {/* Vertical Indicator Line */}
                        <line 
                            x1={x} y1="0" x2={x} y2={height} 
                            stroke={pt.agentColor} 
                            strokeWidth={hoveredIndex === i ? 2 : 1} 
                            strokeOpacity={hoveredIndex === i ? 0.6 : 0.15} 
                            className="transition-all"
                        />
                        
                        {/* Main Node */}
                        <circle 
                            cx={x} cy={yImpact} 
                            r={hoveredIndex === i ? 6 : (isMisaligned ? 5 : 4)} 
                            fill={isMisaligned ? "#3f1a1a" : "#111827"} 
                            stroke={isMisaligned ? "#ef4444" : "#22d3ee"} 
                            strokeWidth={isMisaligned ? 2.5 : 2} 
                            className={`transition-all ${isMisaligned ? 'animate-pulse' : ''}`}
                        />
                        
                        {/* Warning Icon for Misalignment */}
                        {isMisaligned && (
                             <g transform={`translate(${x - 4}, ${height - 20})`}>
                                <circle r="6" cx="4" cy="4" fill="#ef4444" />
                                <text x="4" y="7" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">!</text>
                             </g>
                        )}

                        {/* Interactive Tooltip */}
                        {hoveredIndex === i && (
                        <foreignObject 
                            x={tooltipX} 
                            y={tooltipY} 
                            width={tooltipWidth} 
                            height="120" 
                            style={{ overflow: 'visible', pointerEvents: 'none' }} // Ensure tooltip doesn't block mouse events
                        >
                            <div className="bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-lg p-3 text-[10px] shadow-2xl animate-in fade-in zoom-in-95 duration-100 origin-top-left">
                                <div className="font-bold text-white mb-1.5 border-b border-gray-800 pb-1.5 flex justify-between items-center">
                                    <span style={{ color: pt.agentColor }}>{pt.agentName}</span>
                                    <span className="text-gray-500 font-mono">#{i + 1}</span>
                                </div>
                                
                                <div className="space-y-1 mb-2">
                                    <div className="flex justify-between text-cyan-400">
                                        <span>Impact</span> 
                                        <div className="flex items-center gap-1">
                                            <div className="h-1.5 w-12 bg-gray-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-cyan-400" style={{ width: `${pt.impact}%` }}></div>
                                            </div>
                                            <span>{pt.impact.toFixed(0)}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-purple-400">
                                        <span>Flow</span>
                                        <div className="flex items-center gap-1">
                                            <div className="h-1.5 w-12 bg-gray-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-purple-400" style={{ width: `${pt.flow}%` }}></div>
                                            </div>
                                            <span>{pt.flow.toFixed(0)}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-orange-400">
                                        <span>Consistency</span>
                                        <div className="flex items-center gap-1">
                                            <div className="h-1.5 w-12 bg-gray-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-orange-400" style={{ width: `${pt.consistency}%` }}></div>
                                            </div>
                                            <span>{pt.consistency.toFixed(0)}</span>
                                        </div>
                                    </div>
                                </div>

                                {isMisaligned && (
                                    <div className="mb-2 bg-red-900/20 border border-red-900/50 rounded px-1.5 py-1 text-red-400 font-bold flex items-center gap-1.5">
                                        <AlertCircle className="w-3 h-3 flex-shrink-0" /> 
                                        <span>Metric misalignment</span>
                                    </div>
                                )}
                                
                                <div className="text-gray-400 italic line-clamp-3 bg-black/20 p-1.5 rounded border border-white/5 border-l-2 border-l-gray-600">
                                    "{pt.contentSnippet}"
                                </div>
                            </div>
                        </foreignObject>
                        )}
                    </g>
                    );
                })}
                </svg>
            </div>
        ) : (
            <div className="h-[140px] flex items-center justify-center text-gray-600 text-xs italic border border-gray-800 rounded-lg border-dashed bg-gray-900/30">
                <Activity className="w-4 h-4 mr-2 opacity-50" />
                Awaiting swarm activity data...
            </div>
        )}
      </div>
    </div>
  );
};

export default SwarmTimeline;
