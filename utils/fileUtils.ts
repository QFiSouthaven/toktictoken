import { Message, Agent } from '../types';

/**
 * Triggers a browser download for a given text content.
 */
export const downloadFile = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Formats and exports the chat history.
 */
export const generateExport = (messages: Message[], agents: Agent[], format: 'json' | 'md') => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  
  if (format === 'json') {
      const content = JSON.stringify({ messages, agents: agents.map(a => a.name) }, null, 2);
      downloadFile(content, `swarm-chat-${timestamp}.json`, 'application/json');
  } else {
      const content = messages.map(m => {
          const sender = m.agentId ? agents.find(a => a.id === m.agentId)?.name || 'Agent' : 'User';
          const time = new Date(m.timestamp).toLocaleTimeString();
          return `### ${sender} (${time})\n\n${m.content}\n`;
      }).join('\n---\n\n');
      
      const header = `# Swarm Chat Export\nDate: ${new Date().toLocaleString()}\n\n`;
      downloadFile(header + content, `swarm-chat-${timestamp}.md`, 'text/markdown');
  }
};
