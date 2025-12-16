
export interface TestPlanItem {
  id: string;
  scope: 'Unit' | 'Integration' | 'E2E';
  target: string;
  tool: 'Jest' | 'Cypress' | 'Playwright' | 'Vitest';
  description: string;
  status: 'planned' | 'drafted' | 'implemented';
}

/**
 * Registry of the Testing Strategy.
 * Defines the roadmap for achieving 80% code coverage and robust bridge reliability.
 */
export const TESTING_ROADMAP: TestPlanItem[] = [
  {
    id: 'test-001',
    scope: 'Unit',
    target: 'geminiService.ts',
    tool: 'Vitest',
    description: 'Mock fetch calls to Google Gemini and LM Studio to ensure response parsing logic handles edge cases (empty JSON, network error, rate limits).',
    status: 'planned'
  },
  {
    id: 'test-002',
    scope: 'Integration',
    target: 'proxy.js',
    tool: 'Jest',
    description: 'Verify that the /bridge endpoints correctly queue and dequeue messages between the CLI and App state using supertest.',
    status: 'planned'
  },
  {
    id: 'test-003',
    scope: 'E2E',
    target: 'ChatInterface.tsx',
    tool: 'Playwright',
    description: 'Simulate a full user flow: Open App -> Select Agent -> Send Message -> Receive Response -> Verify Timeline Graph updates.',
    status: 'planned'
  },
  {
    id: 'test-004',
    scope: 'Unit',
    target: 'TerminalPanel.tsx',
    tool: 'Vitest',
    description: 'Test the output analysis regex (analyzeOutputChunk) against known error strings (NPM errors, Git fatal errors) to ensure suggestion logic works.',
    status: 'planned'
  }
];
