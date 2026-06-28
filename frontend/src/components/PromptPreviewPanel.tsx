import { MarkdownView } from './MarkdownView';
import { usePromptDiff } from '../hooks/usePromptDiff';
import { PromptViewTabs } from './PromptViewTabs';
import './PromptPreviewPanel.css';

interface PromptPreviewPanelProps {
  prompt: string;
  previousPrompt: string;
  initialPrompt: string;
  loading: boolean;
}

export function PromptPreviewPanel({
  prompt,
  previousPrompt,
  initialPrompt,
  loading,
}: PromptPreviewPanelProps) {
  const diff = usePromptDiff({ prompt, previousPrompt, initialPrompt, loading });

  return (
    <div className="prompt-preview-panel">
      <PromptViewTabs
        contentView={diff.contentView}
        onContentViewChange={diff.setContentView}
        primaryLabel="プレビュー"
        diffHint={diff.diffHint}
        gitMessage={diff.gitMessage}
        isDiffLoading={diff.isDiffLoading}
        showGitUnavailable={diff.contentView === 'diff-git' && !diff.gitAvailable}
        diffEmptyMessage={diff.diffEmptyMessage}
        diffLines={diff.diffLines}
        primaryContent={
          <>
            <p className="prompt-preview-hint">
              現在の build 設定から生成されたプロンプトのレンダリング結果です。
            </p>
            <MarkdownView content={prompt || '_Prompt is empty._'} />
          </>
        }
      />
    </div>
  );
}
