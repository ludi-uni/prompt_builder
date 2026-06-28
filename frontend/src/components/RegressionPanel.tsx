import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type RegressionCharacterContext,
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

function parseCharacterNamesInput(value: string): string[] {
  return value
    .split(/[,、]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function formatCharacterNames(names: string[]): string {
  return names.join(', ');
}

function characterSourceLabel(source: RegressionCharacterContext['source']): string {
  if (source === 'auto') return '自動検出';
  if (source === 'suite') return 'スイート設定';
  if (source === 'override') return '手動入力';
  return '未設定';
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
  const [characterInput, setCharacterInput] = useState('');
  const [characterSource, setCharacterSource] =
    useState<RegressionCharacterContext['source']>('missing');
  const [characterTouched, setCharacterTouched] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [statusResult, suitesResult, characterResult] = await Promise.all([
        api.getRegressionSnapshotStatus(),
        api.listRegressionSuites(),
        api.getRegressionCharacterContext(),
      ]);
      setStatus(statusResult);
      setSuites(suitesResult.suites);
      setCharacterSource(characterResult.source);
      if (!characterTouched) {
        setCharacterInput(formatCharacterNames(characterResult.names));
      }
      if (
        suitesResult.suites.length > 0 &&
        !suitesResult.suites.some((suite) => suite.filename === selectedSuite)
      ) {
        setSelectedSuite(suitesResult.suites[0].filename);
      }
    } catch (err) {
      onError(err, 'Failed to load regression status');
    }
  }, [characterTouched, onError, selectedSuite]);

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
      const parsedNames = parseCharacterNamesInput(characterInput);
      const result = await api.runRegression({
        suite: selectedSuite,
        character_names: parsedNames.length > 0 ? parsedNames : undefined,
        options: { ensure_snapshot: true, stop_on_first_failure: false },
      });
      setReport(result);
      if (result.character) {
        setCharacterSource(result.character.source);
        if (!characterTouched) {
          setCharacterInput(formatCharacterNames(result.character.names));
        }
      }
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
  }, [
    characterInput,
    characterTouched,
    llmConfigured,
    onBusyChange,
    onError,
    onSuccess,
    refresh,
    selectedSuite,
  ]);

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

      <div className="regression-character-row">
        <label className="regression-character-label" htmlFor="regression-character-names">
          キャラ名
          <span className={`regression-character-source regression-character-source-${characterSource}`}>
            {characterSourceLabel(characterSource)}
          </span>
        </label>
        <input
          id="regression-character-names"
          className="regression-character-input"
          type="text"
          value={characterInput}
          placeholder="例: Airi, アイリ, あいり（カンマ区切りで複数可）"
          disabled={busy || loading}
          onChange={(event) => {
            setCharacterTouched(true);
            setCharacterInput(event.target.value);
            setCharacterSource('override');
          }}
        />
        <p className="regression-character-hint">
          in_character 系テスト（no_character_break など）で使用。プレフィックスの Name: などから自動検出します。
          複数の別名・表記がある場合は、カンマ（,）または読点（、）区切りで入力してください（いずれかが出力に含まれれば PASS）。
        </p>
      </div>

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
            {report.character && report.character.names.length > 0 && (
              <span className="regression-character-tag">
                キャラ: {report.character.names.join(', ')}
              </span>
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
