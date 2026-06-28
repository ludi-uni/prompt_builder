import { useState } from 'react';
import { usePromptDiff } from '../hooks/usePromptDiff';
import { PromptViewTabs } from './PromptViewTabs';
import './PromptPanel.css';

interface PromptPanelProps {
  prompt: string;
  previousPrompt: string;
  initialPrompt: string;
  loading: boolean;
  embedded?: boolean;
}

export function PromptPanel({
  prompt,
  previousPrompt,
  initialPrompt,
  loading,
  embedded = false,
}: PromptPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const diff = usePromptDiff({ prompt, previousPrompt, initialPrompt, loading });

  return (
    <section className={`prompt-panel ${embedded ? 'prompt-panel-embedded' : ''}`}>
      {!embedded && (
        <button
          type="button"
          className="prompt-collapse-toggle"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
        >
          <span className="prompt-collapse-icon">{expanded ? '▼' : '▶'}</span>
          Generated Prompt
          {loading && <span className="prompt-building">Building…</span>}
        </button>
      )}

      {(embedded || expanded) && (
        <div className="prompt-panel-body">
          {embedded && loading && (
            <p className="prompt-building prompt-building-inline">Building…</p>
          )}
          <PromptViewTabs
            contentView={diff.contentView}
            onContentViewChange={diff.setContentView}
            primaryLabel="Raw"
            diffHint={diff.diffHint}
            gitMessage={diff.gitMessage}
            isDiffLoading={diff.isDiffLoading}
            showGitUnavailable={
              diff.contentView === 'diff-git' && !diff.gitAvailable
            }
            diffEmptyMessage={diff.diffEmptyMessage}
            diffLines={diff.diffLines}
            primaryContent={
              <pre className="raw-prompt">{prompt || 'Prompt is empty.'}</pre>
            }
          />
        </div>
      )}
    </section>
  );
}
