
export interface LocaleTask {
  id: string;
  key: string;
  component: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
}

/**
 * Registry for Internationalization (i18n) efforts.
 * Goal: Decouple hardcoded English strings to support global developer teams.
 */
export const I18N_BACKLOG: LocaleTask[] = [
  {
    id: 'i18n-001',
    key: 'system_prompts',
    component: 'App.tsx (INITIAL_AGENTS)',
    description: 'Extract hardcoded system instructions (e.g., "You are the Chief Orchestrator") into a localized JSON registry. This allows agents to speak Spanish, Japanese, etc., based on user config.',
    priority: 'medium'
  },
  {
    id: 'i18n-002',
    key: 'ui_labels',
    component: 'Sidebar.tsx',
    description: 'Externalize UI labels like "Broadcast", "Network Settings", and "Agents Tab" into a translation dictionary.',
    priority: 'low'
  },
  {
    id: 'i18n-003',
    key: 'terminal_suggestions',
    component: 'TerminalPanel.tsx',
    description: 'Ensure the AI error suggestions (e.g., "💡 Git not found") can be generated in the user\'s local language.',
    priority: 'low'
  }
];
