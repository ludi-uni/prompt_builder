import { MarkdownView } from './MarkdownView';
import './PreviewPanel.css';

interface PreviewPanelProps {
  prompt: string;
  loading: boolean;
  mode: 'rendered' | 'raw';
  onModeChange: (mode: 'rendered' | 'raw') => void;
  llmResponse: string | null;
  llmLoading: boolean;
}

export function PreviewPanel({
  prompt,
  loading,
  mode,
  onModeChange,
  llmResponse,
  llmLoading,
}: PreviewPanelProps) {
  return (
    <section className="preview-panel">
      <div className="preview-header">
        <h2>Preview</h2>
        <div className="preview-tabs">
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
      </div>

      <div className="preview-body">
        <h3 className="section-label">Built Prompt</h3>
        {loading ? (
          <p className="loading-text">Building prompt...</p>
        ) : mode === 'rendered' ? (
          <MarkdownView
            content={prompt || '_No export selected or prompt is empty._'}
          />
        ) : (
          <pre className="raw-prompt">
            {prompt || 'No export selected or prompt is empty.'}
          </pre>
        )}

        {(llmResponse || llmLoading) && (
          <>
            <h3 className="section-label">LLM Response</h3>
            {llmLoading ? (
              <p className="loading-text">Running test...</p>
            ) : (
              <MarkdownView content={llmResponse ?? ''} className="llm-response" />
            )}
          </>
        )}
      </div>
    </section>
  );
}
