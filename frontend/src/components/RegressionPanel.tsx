import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type RegressionRunReport,
  type RegressionSnapshotStatus,
  type RegressionSuiteSummary,
} from '../api/client';
import './RegressionPanel.css';

interface RegressionPanelProps {
  llmConfigured: boolean;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onError: (err: unknown, fallback: string) => void;
  onSuccess: (message: string) => void;
}

function freshnessLabel(freshness: RegressionSnapshotStatus['freshness']): string {
  if (freshness === 'fresh') return '✓ fresh';
  if (freshness === 'stale') return '⚠ stale';
  return '○ missing';
}

export function RegressionPanel({
  llmConfigured,
  busy,
  onBusyChange,
  onError,
  onSuccess,
}: RegressionPanelProps) {
  const [status, setStatus] = useState<RegressionSnapshotStatus | null>(null);
  const [suites, setSuites] = useState<RegressionSuiteSummary[]>([]);
  const [selectedSuite, setSelectedSuite] = useState('default.yaml');
  const [report, setReport] = useState<RegressionRunReport | null>(null);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [statusResult, suitesResult] = await Promise.all([
        api.getRegressionSnapshotStatus(),
        api.listRegressionSuites(),
      ]);
      setStatus(statusResult);
      setSuites(suitesResult.suites);
      if (
        suitesResult.suites.length > 0 &&
        !suitesResult.suites.some((suite) => suite.filename === selectedSuite)
      ) {
        setSelectedSuite(suitesResult.suites[0].filename);
      }
    } catch (err) {
      onError(err, 'Failed to load regression status');
    }
  }, [onError, selectedSuite]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleUpdateSnapshot = useCallback(async () => {
    if (!llmConfigured) {
      onError(new Error('LLM is not configured'), 'LLM settings required');
      return;
    }
    onBusyChange(true);
    setLoading(true);
    try {
      await api.createRegressionSnapshot();
      await refresh();
      onSuccess('Snapshot updated');
    } catch (err) {
      onError(err, 'Failed to update snapshot');
    } finally {
      setLoading(false);
      onBusyChange(false);
    }
  }, [llmConfigured, onBusyChange, onError, onSuccess, refresh]);

  const handleRunSuite = useCallback(async () => {
    if (!llmConfigured) {
      onError(new Error('LLM is not configured'), 'LLM settings required');
      return;
    }
    onBusyChange(true);
    setLoading(true);
    setReport(null);
    try {
      const result = await api.runRegression({
        suite: selectedSuite,
        options: { ensure_snapshot: true, stop_on_first_failure: false },
      });
      setReport(result);
      await refresh();
      const failed = result.summary.failed;
      if (failed > 0) {
        onError(new Error(`${failed} case(s) failed`), 'Regression run completed with failures');
      } else {
        onSuccess(`Regression passed (${result.summary.passed}/${result.summary.total})`);
      }
    } catch (err) {
      onError(err, 'Regression run failed');
    } finally {
      setLoading(false);
      onBusyChange(false);
    }
  }, [llmConfigured, onBusyChange, onError, onSuccess, refresh, selectedSuite]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        void handleUpdateSnapshot();
      }
      if (key === 'r') {
        event.preventDefault();
        void handleRunSuite();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUpdateSnapshot, handleRunSuite]);

  const freshness = status?.freshness ?? 'missing';
  const prefixTokens =
    status?.current.prefix_tokens ?? status?.prefix_tokens_estimate ?? null;

  return (
    <div className="regression-panel">
      {!llmConfigured && (
        <div className="regression-banner regression-banner-warn">
          LLM 未設定です。ツールバーの LLM から接続先を設定してください。
        </div>
      )}
      {status && !status.slot_save_path_configured && (
        <div className="regression-banner regression-banner-warn">
          config/llama.yaml に --slot-save-path を追加し、llama-server を再起動してください。
        </div>
      )}
      {freshness === 'stale' && (
        <div className="regression-banner regression-banner-warn">
          プロンプトが変更されています。Snapshot を更新してください。
        </div>
      )}

      <div className="regression-toolbar">
        <div className={`regression-snapshot-status regression-snapshot-${freshness}`}>
          Snapshot: {freshnessLabel(freshness)}
          {prefixTokens != null ? ` (${prefixTokens} tok)` : ''}
        </div>
        <div className="regression-actions">
          <button
            type="button"
            className="regression-btn"
            disabled={busy || loading || !llmConfigured}
            onClick={() => void handleUpdateSnapshot()}
          >
            Update Snapshot
          </button>
          <select
            className="regression-suite-select"
            value={selectedSuite}
            disabled={busy || loading || suites.length === 0}
            onChange={(e) => setSelectedSuite(e.target.value)}
          >
            {suites.map((suite) => (
              <option key={suite.filename} value={suite.filename}>
                {suite.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="regression-btn regression-btn-primary"
            disabled={busy || loading || !llmConfigured || suites.length === 0}
            onClick={() => void handleRunSuite()}
          >
            Run Suite
          </button>
        </div>
      </div>

      {loading && <p className="regression-loading">Running regression...</p>}

      {report && (
        <div className="regression-results">
          <div className="regression-summary">
            <span>
              {report.summary.passed}/{report.summary.total} passed
            </span>
            {report.snapshot.stale && (
              <span className="regression-stale-tag">stale snapshot</span>
            )}
          </div>
          <ul className="regression-case-list">
            {report.cases.map((caseResult) => {
              const expanded = expandedCase === caseResult.id;
              return (
                <li
                  key={caseResult.id}
                  className={`regression-case regression-case-${caseResult.status}`}
                >
                  <button
                    type="button"
                    className="regression-case-header"
                    onClick={() =>
                      setExpandedCase(expanded ? null : caseResult.id)
                    }
                  >
                    <span className="regression-case-icon">
                      {caseResult.status === 'pass'
                        ? '✓'
                        : caseResult.status === 'fail'
                          ? '✗'
                          : '!'}
                    </span>
                    <span className="regression-case-id">{caseResult.id}</span>
                    {caseResult.failures && caseResult.failures.length > 0 && (
                      <span className="regression-case-reason">
                        {caseResult.failures[0].message}
                      </span>
                    )}
                    {caseResult.error && (
                      <span className="regression-case-reason">{caseResult.error}</span>
                    )}
                  </button>
                  {expanded && (
                    <div className="regression-case-detail">
                      <p>
                        <strong>入力:</strong> {caseResult.input}
                      </p>
                      {caseResult.output && (
                        <pre>{caseResult.output}</pre>
                      )}
                      {caseResult.failures?.map((failure) => (
                        <p key={`${caseResult.id}-${failure.matcher}`} className="regression-failure">
                          {failure.matcher}: {failure.message}
                        </p>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!report && !loading && (
        <div className="regression-empty">
          <p>Update Snapshot で Prefix の KV を保存し、Run Suite で一括テストします。</p>
        </div>
      )}
    </div>
  );
}
