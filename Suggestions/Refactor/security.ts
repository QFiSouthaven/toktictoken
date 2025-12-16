
export interface SecurityAuditItem {
  id: string;
  scope: 'Client' | 'Server' | 'Network' | 'Data';
  severity: 'critical' | 'high' | 'medium' | 'low';
  vulnerability: string;
  mitigation: string;
  status: 'open' | 'mitigated' | 'accepted_risk';
}

/**
 * Registry of security audits and hardening measures.
 * Critical for ensuring the 'Local Swarm' does not expose the host machine to external threats via the bridge.
 */
export const SECURITY_AUDIT_LOG: SecurityAuditItem[] = [
  {
    id: 'sec-001',
    scope: 'Server',
    severity: 'high',
    vulnerability: 'Unrestricted Command Execution',
    mitigation: 'Implement an allowlist of permitted shell commands in proxy.js (e.g., only allow npm, git, node) to prevent arbitrary code execution if the local server is exposed.',
    status: 'mitigated'
  },
  {
    id: 'sec-002',
    scope: 'Network',
    severity: 'medium',
    vulnerability: 'Permissive CORS Policy',
    mitigation: 'Update proxy.js to explicitly whitelist "http://localhost:3000" instead of reflecting the origin, to prevent CSRF attacks from malicious local sites.',
    status: 'mitigated'
  },
  {
    id: 'sec-003',
    scope: 'Data',
    severity: 'low',
    vulnerability: 'Chat History in Plaintext',
    mitigation: 'If storing sensitive API keys or credentials in chat memory, implement encryption-at-rest for the MongoDB message collection.',
    status: 'accepted_risk'
  }
];
