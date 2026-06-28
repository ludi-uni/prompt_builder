import type { ReactNode } from 'react';
import type { DiffLine } from '../utils/lineDiff';
import { DiffView } from './DiffView';
import type { PromptDiffView } from '../hooks/usePromptDiff';
import './PromptViewTabs.css';

interface PromptViewTabsProps {
  contentView: PromptDiffView;
  onContentViewChange: (view: PromptDiffView) => void;
  primaryLabel: string;
  diffHint: string | null;
  gitMessage: string | null;
  isDiffLoading: boolean;
  showGitUnavailable: boolean;
  diffEmptyMessage: string;
  diffLines: DiffLine[];
  primaryContent: ReactNode;
}

export function PromptViewTabs({
  contentView,
  onContentViewChange,
  primaryLabel,
  diffHint,
  gitMessage,
  isDiffLoading,
  showGitUnavailable,
  diffEmptyMessage,
  diffLines,
  primaryContent,
}: PromptViewTabsProps) {
  return (
    <>
      <div className="prompt-view-toolbar">
        <div className="prompt-view-tabs">
          <button
            type="button"
            className={contentView === 'primary' ? 'active' : ''}
            onClick={() => onContentViewChange('primary')}
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            className={contentView === 'diff-prev' ? 'active' : ''}
            onClick={() => onContentViewChange('diff-prev')}
          >
            Diff
          </button>
          <button
            type="button"
            className={contentView === 'diff-git' ? 'active' : ''}
            onClick={() => onContentViewChange('diff-git')}
          >
            vs Git
          </button>
        </div>
      </div>

      {contentView === 'diff-prev' && diffHint && (
        <p className="prompt-diff-hint">{diffHint}</p>
      )}

      {contentView === 'diff-git' && gitMessage && (
        <p className="prompt-git-hint">{gitMessage}</p>
      )}

      {isDiffLoading ? (
        <p className="loading-text">Building prompt...</p>
      ) : contentView === 'primary' ? (
        primaryContent
      ) : showGitUnavailable ? (
        <p className="diff-empty">{gitMessage ?? 'Git との比較は利用できません'}</p>
      ) : (
        <DiffView lines={diffLines} emptyMessage={diffEmptyMessage} />
      )}
    </>
  );
}
