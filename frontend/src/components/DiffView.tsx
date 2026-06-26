import type { DiffLine } from '../utils/lineDiff';
import './DiffView.css';

interface DiffViewProps {
  lines: DiffLine[];
  emptyMessage?: string;
}

export function DiffView({ lines, emptyMessage = '差分はありません' }: DiffViewProps) {
  const hasChanges = lines.some((line) => line.type !== 'same');

  if (!hasChanges) {
    return <p className="diff-empty">{emptyMessage}</p>;
  }

  return (
    <pre className="diff-view">
      {lines.map((line, index) => {
        if (line.type === 'same') {
          return (
            <span key={index} className="diff-line diff-same">
              {'  '}
              {line.text}
              {'\n'}
            </span>
          );
        }
        const prefix = line.type === 'add' ? '+' : '-';
        return (
          <span key={index} className={`diff-line diff-${line.type}`}>
            {prefix} {line.text}
            {'\n'}
          </span>
        );
      })}
    </pre>
  );
}
