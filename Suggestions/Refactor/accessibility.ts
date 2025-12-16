
export interface A11yItem {
  id: string;
  wcagCriterion: string; // e.g., "1.4.3 Contrast (Minimum)"
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  location: string;
  description: string;
  remediation: string;
}

/**
 * Registry of Accessibility Audits.
 * Target: WCAG 2.1 Level AA Compliance.
 */
export const ACCESSIBILITY_AUDIT_LOG: A11yItem[] = [
  {
    id: 'a11y-001',
    wcagCriterion: '2.1.1 Keyboard',
    severity: 'critical',
    location: 'Sidebar.tsx',
    description: 'Agent selection buttons are not strictly reachable via Tab navigation when the list is long.',
    remediation: 'Ensure all interactive elements have tabIndex="0" and handle onKeyDown (Enter/Space) events.'
  },
  {
    id: 'a11y-002',
    wcagCriterion: '1.4.3 Contrast',
    severity: 'moderate',
    location: 'TerminalPanel.tsx',
    description: 'The dark gray text (#4b5563) on black background may fail contrast ratio requirements for visually impaired users.',
    remediation: 'Lighten the default terminal text color to #9ca3af (gray-400) or allow user-configurable themes.'
  },
  {
    id: 'a11y-003',
    wcagCriterion: '4.1.2 Name, Role, Value',
    severity: 'serious',
    location: 'ChatInterface.tsx',
    description: 'The "Share" dropdown does not announce its expanded/collapsed state to screen readers.',
    remediation: 'Add aria-expanded state and aria-haspopup attributes to the dropdown trigger button.'
  }
];
