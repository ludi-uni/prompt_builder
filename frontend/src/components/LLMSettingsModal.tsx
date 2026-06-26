import { useCallback, useEffect, useState } from 'react';
import { api, type LLMConfig } from '../api/client';
import './LLMSettingsModal.css';

interface LLMSettingsModalProps {
  config: LLMConfig | null;
  onSave: (config: LLMConfig) => Promise<void>;
  onClose: () => void;
}

export function LLMSettingsModal({ config, onSave, onClose }: LLMSettingsModalProps) {
  const [serverUrl, setServerUrl] = useState(
    config?.server_url ?? 'http://127.0.0.1:8080',
  );
  const [timeout, setTimeout] = useState(config?.timeout_seconds ?? 120);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [healthMessage, setHealthMessage] = useState<string | null>(null);
  const [healthOk, setHealthOk] = useState<boolean | null>(null);

  const checkConnection = useCallback(async (url: string) => {
    setChecking(true);
    setHealthMessage(null);
    try {
      const health = await api.checkLLMHealth(url);
      if (health.reachable) {
        setHealthOk(true);
        setHealthMessage('llama-server に接続できました');
      } else {
        setHealthOk(false);
        setHealthMessage(health.error ?? '接続できません');
      }
    } catch (err) {
      setHealthOk(false);
      setHealthMessage(err instanceof Error ? err.message : '接続確認に失敗しました');
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkConnection(config?.server_url ?? 'http://127.0.0.1:8080');
  }, [checkConnection, config?.server_url]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ server_url: serverUrl, timeout_seconds: timeout });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal llm-modal" onClick={(e) => e.stopPropagation()}>
        <h3>LLM Settings (llama-server)</h3>
        <p className="modal-hint">
          別ターミナルで <code>npm run llama</code> を実行して llama-server
          を起動してください。未設定の場合は LLM 機能は無効です。
        </p>
        <label>
          Server URL
          <input
            value={serverUrl}
            onChange={(e) => {
              setServerUrl(e.target.value);
              setHealthOk(null);
              setHealthMessage(null);
            }}
            placeholder="http://127.0.0.1:8080"
          />
        </label>
        <label>
          Timeout (seconds)
          <input
            type="number"
            min={10}
            max={600}
            value={timeout}
            onChange={(e) => setTimeout(Number(e.target.value))}
          />
        </label>
        <div className="llm-health-row">
          <button
            type="button"
            className="btn-secondary"
            disabled={checking || !serverUrl}
            onClick={() => void checkConnection(serverUrl)}
          >
            {checking ? '確認中…' : '接続確認'}
          </button>
          {healthMessage && (
            <span
              className={healthOk ? 'llm-health-status ok' : 'llm-health-status error'}
            >
              {healthMessage}
            </span>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
