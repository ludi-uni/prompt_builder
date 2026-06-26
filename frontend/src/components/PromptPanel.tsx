import { useEffect, useMemo, useState } from 'react';
import type { ExportItem } from '../api/client';
import { api } from '../api/client';
import { computeLineDiff } from '../utils/lineDiff';
import { DiffView } from './DiffView';
import { MarkdownView } from './MarkdownView';
import './PromptPanel.css';

type PromptContentView = 'full' | 'diff-prev' | 'diff-mode' | 'diff-git';

interface PromptPanelProps {
  prompt: string;
  previousPrompt: string;
  exports: ExportItem[];
  selectedExport: string | null;
  loading: boolean;
  mode: 'rendered' | 'raw';
  onModeChange: (mode: 'rendered' | 'raw') => void;
}

export function PromptPanel({
  prompt,
  previousPrompt,
  exports,
  selectedExport,
  loading,
  mode,
  onModeChange,
}: PromptPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [contentView, setContentView] = useState<PromptContentView>('full');
  const [compareExportId, setCompareExportId] = useState<string>('');
  const [comparePrompt, setComparePrompt] = useState('');
  const [compareLoading, setCompareLoading] = useState(false);
  const [gitBaseline, setGitBaseline] = useState('');
  const [gitMessage, setGitMessage] = useState<string | null>(null);
  const [gitAvailable, setGitAvailable] = useState(false);
  const [gitLoading, setGitLoading] = useState(false);

  const otherExports = useMemo(
    () => exports.filter((item) => item.id !== selectedExport),
    [exports, selectedExport],
  );

  useEffect(() => {
    if (contentView !== 'diff-mode') return;
    if (!compareExportId) {
      setComparePrompt('');
      return;
    }

    let cancelled = false;
    setCompareLoading(true);
    void api
      .buildExport(compareExportId)
      .then((result) => {
        if (!cancelled) setComparePrompt(result.prompt);
      })
      .catch(() => {
        if (!cancelled) setComparePrompt('');
      })
      .finally(() => {
        if (!cancelled) setCompareLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [contentView, compareExportId]);

  useEffect(() => {
    if (contentView !== 'diff-git' || !selectedExport) return;

    let cancelled = false;
    setGitLoading(true);
    void api
      .getGitBaseline(selectedExport)
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
  }, [contentView, selectedExport]);

  useEffect(() => {
    if (otherExports.length === 0) {
      setCompareExportId('');
      return;
    }
    if (!compareExportId || !otherExports.some((item) => item.id === compareExportId)) {
      setCompareExportId(otherExports[0].id);
    }
  }, [otherExports, compareExportId]);

  const diffLines = useMemo(() => {
    if (contentView === 'diff-prev') {
      return computeLineDiff(previousPrompt, prompt);
    }
    if (contentView === 'diff-mode') {
      return computeLineDiff(comparePrompt, prompt);
    }
    if (contentView === 'diff-git') {
      return computeLineDiff(gitBaseline, prompt);
    }
    return [];
  }, [contentView, previousPrompt, comparePrompt, gitBaseline, prompt]);

  const compareModeName =
    otherExports.find((item) => item.id === compareExportId)?.name ?? 'Mode';

  const isDiffLoading =
    loading ||
    (contentView === 'diff-mode' && compareLoading) ||
    (contentView === 'diff-git' && gitLoading);

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
                className={contentView === 'diff-mode' ? 'active' : ''}
                onClick={() => setContentView('diff-mode')}
                disabled={otherExports.length === 0}
              >
                vs Mode
              </button>
              <button
                type="button"
                className={contentView === 'diff-git' ? 'active' : ''}
                onClick={() => setContentView('diff-git')}
                disabled={!selectedExport}
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

          {contentView === 'diff-mode' && otherExports.length > 0 && (
            <label className="prompt-compare-select">
              Compare with
              <select
                value={compareExportId}
                onChange={(e) => setCompareExportId(e.target.value)}
              >
                {otherExports.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}

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
                  : contentView === 'diff-git'
                    ? 'Git baseline との差分はありません'
                    : `${compareModeName} との差分はありません`
              }
            />
          )}
        </div>
      )}
    </section>
  );
}
