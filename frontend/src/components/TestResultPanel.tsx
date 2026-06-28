import { MarkdownView } from './MarkdownView';
import type { LLMUsage } from '../api/client';
import './TestResultPanel.css';

interface TestResultPanelProps {
  inputPrompt: string;
  llmResponse: string | null;
  llmUsage: LLMUsage | null;
  llmLoading: boolean;
}

function formatMetric(value: number | null | undefined, suffix = ''): string {
  if (value === null || value === undefined) return '-';
  return `${value}${suffix}`;
}

export function TestResultPanel({
  inputPrompt,
  llmResponse,
  llmUsage,
  llmLoading,
}: TestResultPanelProps) {
  return (
    <section className="test-result-panel">
      <div className="test-result-header">
        <h2>Test Result</h2>
      </div>
      <div className="test-result-body">
        {llmLoading ? (
          <p className="loading-text">Running test...</p>
        ) : llmResponse ? (
          <>
            <h3 className="section-label">入力</h3>
            <pre className="test-input-preview">
              {inputPrompt.length > 600
                ? `${inputPrompt.slice(0, 600)}\n…`
                : inputPrompt || '(empty)'}
            </pre>

            <h3 className="section-label">出力</h3>
            <MarkdownView content={llmResponse} className="llm-response" />

            <div className="test-metrics">
              <div className="metric-item">
                <span className="metric-label">Tokens</span>
                <span className="metric-value">
                  {formatMetric(llmUsage?.total_tokens)}
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">TPS</span>
                <span className="metric-value">{formatMetric(llmUsage?.tps)}</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">TTFT</span>
                <span className="metric-value">
                  {llmUsage?.ttft_ms != null ? `${llmUsage.ttft_ms}ms` : '-'}
                </span>
              </div>
            </div>
            {llmUsage && (
              <p className="metric-detail">
                prompt: {formatMetric(llmUsage.prompt_tokens)} / completion:{' '}
                {formatMetric(llmUsage.completion_tokens)}
                {llmUsage.total_ms != null ? ` / total: ${llmUsage.total_ms}ms` : ''}
              </p>
            )}
          </>
        ) : (
          <div className="test-result-empty">
            <p>RUN TEST でプロンプトを LLM に送信し、結果をここに表示します。</p>
            {!inputPrompt && (
              <p className="test-result-hint">Component を編集してください。</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
