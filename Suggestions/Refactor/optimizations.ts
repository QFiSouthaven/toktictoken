
export interface OptimizationStrategy {
  id: string;
  target: string;
  type: 'runtime' | 'loadtime' | 'memory';
  priority: 'p0' | 'p1' | 'p2';
  description: string;
  estimatedGain: string;
}

/**
 * Registry of planned performance optimizations.
 * Focused on reducing Time-to-Interactive (TTI) and maintaining 60fps during heavy swarm activity.
 */
export const PERFORMANCE_OPTIMIZATIONS: OptimizationStrategy[] = [
  {
    id: 'opt-001',
    target: 'SwarmTimeline.tsx',
    type: 'runtime',
    priority: 'p1',
    description: 'Memoize heavy SVG path calculations using useMemo. Currently recalculates on every render even if messages prop hasn\'t changed.',
    estimatedGain: 'Reduce render time by ~15ms per tick during rapid message ingestion'
  },
  {
    id: 'opt-002',
    target: 'TerminalPanel.tsx',
    type: 'memory',
    priority: 'p2',
    description: 'Implement virtual scrolling (windowing) for terminal history to prevent DOM node proliferation during long execution sessions.',
    estimatedGain: 'Stable DOM node count < 500 regardless of history length'
  },
  {
    id: 'opt-003',
    target: 'geminiService.ts',
    type: 'loadtime',
    priority: 'p2',
    description: 'Lazy load the GoogleGenAI SDK. It is currently bundled in the main chunk but only needed when a message is sent.',
    estimatedGain: 'Reduce initial bundle size by ~40kb (gzipped)'
  }
];
