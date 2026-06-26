import { useState } from 'react'
import type { LLMConfig } from '../api/client'
import './LLMSettingsModal.css'

interface LLMSettingsModalProps {
  config: LLMConfig | null
  onSave: (config: LLMConfig) => Promise<void>
  onClose: () => void
}

export function LLMSettingsModal({ config, onSave, onClose }: LLMSettingsModalProps) {
  const [serverUrl, setServerUrl] = useState(config?.server_url ?? 'http://127.0.0.1:8080')
  const [timeout, setTimeout] = useState(config?.timeout_seconds ?? 120)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({ server_url: serverUrl, timeout_seconds: timeout })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal llm-modal" onClick={(e) => e.stopPropagation()}>
        <h3>LLM Settings (llama-server)</h3>
        <p className="modal-hint">
          Connect to a local llama-server instance. Leave unset to disable LLM features.
        </p>
        <label>
          Server URL
          <input
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
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
        <div className="modal-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" disabled={saving} onClick={() => void handleSave()}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
