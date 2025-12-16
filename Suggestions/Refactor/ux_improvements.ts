
export interface UXItem {
  id: string;
  category: 'Interaction' | 'Visual' | 'Feedback' | 'Navigation';
  priority: 'p0' | 'p1' | 'p2';
  issue: string;
  solution: string;
  status: 'pending' | 'designed' | 'implemented';
}

/**
 * Registry of User Experience (UX) improvements.
 * Focused on reducing cognitive load and increasing "Time to Joy" for the developer.
 */
export const UX_IMPROVEMENT_LOG: UXItem[] = [
  {
    id: 'ux-001',
    category: 'Feedback',
    priority: 'p1',
    issue: 'Ambiguous Swarm State',
    solution: 'Implement a specific "Orchestrator State" indicator in the timeline to show exactly who is waiting for the "Swinging Door" lock.',
    status: 'pending'
  },
  {
    id: 'ux-002',
    category: 'Interaction',
    priority: 'p2',
    issue: 'Terminal Scroll Jumping',
    solution: 'Implement "Smart Scroll" in TerminalPanel.tsx: only auto-scroll if the user was already at the bottom. If they are reading history, do not jump.',
    status: 'pending'
  },
  {
    id: 'ux-003',
    category: 'Visual',
    priority: 'p1',
    issue: 'Markdown Flash',
    solution: 'Add a skeleton loader or a "StreamingRenderer" component to prevent layout shifts while the Markdown response is being tokenized.',
    status: 'pending'
  }
];
