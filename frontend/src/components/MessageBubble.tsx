import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { UiMessage } from '../lib/store.js';

export function MessageBubble({ message }: { message: UiMessage }) {
  const cls = `bubble bubble-${message.role}${message.pending ? ' pending' : ''}`;
  return (
    <div className={`bubble-row bubble-row-${message.role}`}>
      <div className={cls}>
        {message.attachments && message.attachments.length > 0 && (
          <div className="bubble-attachments">
            {message.attachments.map((a, i) =>
              a.kind === 'image' ? (
                <img key={i} src={a.url} alt="" className="bubble-img" />
              ) : (
                <a key={i} href={a.url} className="bubble-file" target="_blank" rel="noreferrer">
                  📎 attachment
                </a>
              ),
            )}
          </div>
        )}
        {message.role === 'user' ? (
          <pre className="bubble-plain">{message.content}</pre>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {message.content || (message.pending ? '…' : '')}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}
