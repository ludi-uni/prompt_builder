import type { LLMUsage } from '../api/client';
import { PromptPanel } from './PromptPanel';
import { PromptPreviewPanel } from './PromptPreviewPanel';
import { TestResultPanel } from './TestResultPanel';
import './RightPanel.css';

export type RightPanelTab = 'prompt' | 'preview' | 'test';

interface RightPanelProps {
  tab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  builtPrompt: string;
  previousPrompt: string;
  initialPrompt: string;
  promptLoading: boolean;
  inputPrompt: string;
  llmResponse: string | null;
  llmUsage: LLMUsage | null;
  llmLoading: boolean;
  llmConfigured: boolean;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onError: (err: unknown, fallback: string) => void;
  onSuccess: (message: string) => void;
}

const TAB_LABELS: Record<RightPanelTab, string> = {
  prompt: '生成プロンプト',
  preview: 'プレビュー',
  test: 'テスト',
};

export function RightPanel({
  tab,
  onTabChange,
  builtPrompt,
  previousPrompt,
  initialPrompt,
  promptLoading,
  inputPrompt,
  llmResponse,
  llmUsage,
  llmLoading,
  llmConfigured,
  busy,
  onBusyChange,
  onError,
  onSuccess,
}: RightPanelProps) {
  return (
    <section className="right-panel">
      <div className="right-panel-tabs" role="tablist" aria-label="Prompt workspace">
        {(Object.keys(TAB_LABELS) as RightPanelTab[]).map((tabId) => (
          <button
            key={tabId}
            type="button"
            role="tab"
            aria-selected={tab === tabId}
            className={`right-panel-tab ${tab === tabId ? 'active' : ''}`}
            onClick={() => onTabChange(tabId)}
          >
            {TAB_LABELS[tabId]}
          </button>
        ))}
      </div>
      <div className="right-panel-body">
        {tab === 'prompt' && (
          <PromptPanel
            prompt={builtPrompt}
            previousPrompt={previousPrompt}
            initialPrompt={initialPrompt}
            loading={promptLoading}
            embedded
          />
        )}
        {tab === 'preview' && (
          <PromptPreviewPanel
            prompt={builtPrompt}
            previousPrompt={previousPrompt}
            initialPrompt={initialPrompt}
            loading={promptLoading}
          />
        )}
        {tab === 'test' && (
          <TestResultPanel
            embedded
            inputPrompt={inputPrompt}
            llmResponse={llmResponse}
            llmUsage={llmUsage}
            llmLoading={llmLoading}
            llmConfigured={llmConfigured}
            busy={busy}
            onBusyChange={onBusyChange}
            onError={onError}
            onSuccess={onSuccess}
          />
        )}
      </div>
    </section>
  );
}
