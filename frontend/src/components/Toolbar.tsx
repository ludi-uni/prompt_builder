import type { ExportItem } from '../api/client';
import './Toolbar.css';

interface ToolbarProps {
  exports: ExportItem[];
  selectedExport: string | null;
  onExportChange: (exportId: string) => void;
  onExportPrompt: () => void;
  onRunTest: () => void;
  onOpenLLMSettings: () => void;
  llmConfigured: boolean;
  llmReachable: boolean;
  busy: boolean;
}

export function Toolbar({
  exports,
  selectedExport,
  onExportChange,
  onExportPrompt,
  onRunTest,
  onOpenLLMSettings,
  llmConfigured,
  llmReachable,
  busy,
}: ToolbarProps) {
  const llmLabel = !llmConfigured ? '○' : llmReachable ? '✓' : '!';
  const llmTitle = !llmConfigured
    ? 'LLM 未設定'
    : llmReachable
      ? 'llama-server 接続 OK'
      : 'llama-server に接続できません（npm run llama）';

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <h1 className="app-title">Prompt Studio</h1>
      </div>
      <div className="toolbar-center">
        <label className="export-select">
          Export:
          <select
            value={selectedExport ?? ''}
            onChange={(e) => onExportChange(e.target.value)}
            disabled={exports.length === 0}
          >
            {exports.length === 0 && <option value="">No exports</option>}
            {exports.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="toolbar-right">
        <button
          type="button"
          className="btn-secondary"
          title={llmTitle}
          onClick={onOpenLLMSettings}
        >
          LLM {llmLabel}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={onRunTest}
          disabled={busy || !selectedExport}
        >
          Run Test
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={onExportPrompt}
          disabled={busy || !selectedExport}
        >
          Export Prompt
        </button>
      </div>
    </header>
  );
}
