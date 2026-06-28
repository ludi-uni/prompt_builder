import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { computeLineDiff } from '../utils/lineDiff';
import { DiffView } from './DiffView';
import { MarkdownView } from './MarkdownView';
import './PromptPanel.css';

type PromptContentView = 'full' | 'diff-prev' | 'diff-git';

interface PromptPanelProps {
  prompt: string;
  previousPrompt: string;
  loading: boolean;
  mode: 'rendered' | 'raw';
  onModeChange: (mode: 'rendered' | 'raw') => void;
}

export function PromptPanel({
  prompt,
  previousPrompt,
  loading,
  mode,
  onModeChange,
}: PromptPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [contentView, setContentView] = useState<PromptContentView>('full');
  const [gitBaseline, setGitBaseline] = useState('');
  const [gitMessage, setGitMessage] = useState<string | null>(null);
  const [gitAvailable, setGitAvailable] = useState(false);
  const [gitLoading, setGitLoading] = useState(false);

  useEffect(() => {
    if (contentView !== 'diff-git') return;

    let cancelled = false;
    setGitLoading(true);
    void api
      .getGitBaseline()
      .then((result) => {
        if (cancelled) return;
        setGitAvailable(result.available);
        setGitBaseline(result.prompt ?? '');
        setGitMessage(result.message);
      })
      .catch((err) => {
        if (cancelled) return;
        setGitAvailable(false);
        setGitBaseline('');
        setGitMessage(
          err instanceof Error ? err.message : 'Git baseline の取得に失敗しました',
        );
      })
      .finally(() => {
        if (!cancelled) setGitLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [contentView]);

  const diffLines = useMemo(() => {
    if (contentView === 'diff-prev') {
      return computeLineDiff(previousPrompt, prompt);
    }
    if (contentView === 'diff-git') {
      return computeLineDiff(gitBaseline, prompt);
    }
    return [];
  }, [contentView, previousPrompt, gitBaseline, prompt]);

  const isDiffLoading = loading || (contentView === 'diff-git' && gitLoading);

  return (
    <section className="prompt-panel">
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

      {expanded && (
        <div className="prompt-panel-body">
          <div className="prompt-toolbar">
            <div className="prompt-view-tabs">
              <button
                type="button"
                className={contentView === 'full' ? 'active' : ''}
                onClick={() => setContentView('full')}
              >
                Full
              </button>
              <button
                type="button"
                className={contentView === 'diff-prev' ? 'active' : ''}
                onClick={() => setContentView('diff-prev')}
              >
                Diff
              </button>
              <button
                type="button"
                className={contentView === 'diff-git' ? 'active' : ''}
                onClick={() => setContentView('diff-git')}
              >
                vs Git
              </button>
            </div>
            {contentView === 'full' && (
              <div className="prompt-mode-tabs">
                <button
                  type="button"
                  className={mode === 'rendered' ? 'active' : ''}
                  onClick={() => onModeChange('rendered')}
                >
                  Rendered
                </button>
                <button
                  type="button"
                  className={mode === 'raw' ? 'active' : ''}
                  onClick={() => onModeChange('raw')}
                >
                  Raw
                </button>
              </div>
            )}
          </div>

          {contentView === 'diff-git' && gitMessage && (
            <p className="prompt-git-hint">{gitMessage}</p>
          )}

          {isDiffLoading ? (
            <p className="loading-text">Building prompt...</p>
          ) : contentView === 'full' ? (
            mode === 'rendered' ? (
              <MarkdownView content={prompt || '_Prompt is empty._'} />
            ) : (
              <pre className="raw-prompt">{prompt || 'Prompt is empty.'}</pre>
            )
          ) : contentView === 'diff-git' && !gitAvailable ? (
            <p className="diff-empty">{gitMessage ?? 'Git との比較は利用できません'}</p>
          ) : (
            <DiffView
              lines={diffLines}
              emptyMessage={
                contentView === 'diff-prev'
                  ? '前回ビルドとの差分はありません'
                  : 'Git baseline との差分はありません'
              }
            />
          )}
        </div>
      )}
    </section>
  );
}
