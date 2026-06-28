import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { computeLineDiff } from '../utils/lineDiff';

export type PromptDiffView = 'primary' | 'diff-prev' | 'diff-git';

interface UsePromptDiffOptions {
  prompt: string;
  previousPrompt: string;
  initialPrompt: string;
  loading: boolean;
  initialView?: PromptDiffView;
}

export function usePromptDiff({
  prompt,
  previousPrompt,
  initialPrompt,
  loading,
  initialView = 'primary',
}: UsePromptDiffOptions) {
  const [contentView, setContentView] = useState<PromptDiffView>(initialView);
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

  const diffBaseline = previousPrompt || initialPrompt;
  const usesInitialBaseline = !previousPrompt && Boolean(initialPrompt);

  const diffLines = useMemo(() => {
    if (contentView === 'diff-prev') {
      return computeLineDiff(diffBaseline, prompt);
    }
    if (contentView === 'diff-git') {
      return computeLineDiff(gitBaseline, prompt);
    }
    return [];
  }, [contentView, diffBaseline, gitBaseline, prompt]);

  const isDiffLoading = loading || (contentView === 'diff-git' && gitLoading);

  const diffEmptyMessage =
    contentView === 'diff-prev'
      ? usesInitialBaseline
        ? '初期プロンプトとの差分はありません'
        : '前回 Save との差分はありません'
      : 'Git baseline との差分はありません';

  const diffHint =
    contentView === 'diff-prev'
      ? usesInitialBaseline
        ? '起動時の初期プロンプトとの差分です。ファイル編集後は Save してから確認してください。'
        : '前回 Save 時点の生成プロンプトとの差分です。'
      : null;

  return {
    contentView,
    setContentView,
    diffLines,
    usesInitialBaseline,
    gitMessage,
    gitAvailable,
    isDiffLoading,
    diffEmptyMessage,
    diffHint,
  };
}
