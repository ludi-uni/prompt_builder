import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './MarkdownView.css';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

export function MarkdownView({ content, className = '' }: MarkdownViewProps) {
  return (
    <div className={`markdown-view ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
