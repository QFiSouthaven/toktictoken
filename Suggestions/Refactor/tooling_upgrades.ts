
export interface ToolingTask {
  id: string;
  category: 'Linting' | 'Hooks' | 'Build' | 'Analytics';
  tool: string;
  description: string;
  benefit: string;
  status: 'proposed' | 'approved' | 'implemented';
}

/**
 * Registry of Tooling & DevEx Upgrades.
 * Aimed at automating code quality and enforcing architectural standards.
 */
export const TOOLING_UPGRADES: ToolingTask[] = [
  {
    id: 'tool-001',
    category: 'Hooks',
    tool: 'Husky + lint-staged',
    description: 'Implement pre-commit hooks to run ESLint and Prettier on changed files only.',
    benefit: 'Prevents bad code from entering the repo; enforces style consistency automatically.',
    status: 'proposed'
  },
  {
    id: 'tool-002',
    category: 'Build',
    tool: 'Bundle Analyzer',
    description: 'Integrate rollup-plugin-visualizer into the Vite build pipeline.',
    benefit: 'Provides visibility into large dependencies (e.g., @google/genai, lucide-react) to guide tree-shaking efforts.',
    status: 'proposed'
  },
  {
    id: 'tool-003',
    category: 'Linting',
    tool: 'eslint-plugin-react-hooks',
    description: 'Enforce strict rules for useEffect dependencies.',
    benefit: 'Prevents stale closures and infinite render loops in the Swarm orchestration logic.',
    status: 'proposed'
  }
];
