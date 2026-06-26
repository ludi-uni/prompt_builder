import { useEffect, useRef, useState } from 'react';
import type { ExportItem } from '../api/client';
import './Toolbar.css';

interface ToolbarProps {
  exports: ExportItem[];
  selectedExport: string | null;
  onExportChange: (exportId: string) => void;
  onExportPrompt: () => void;
  onRunTest: () => void;
  onOpenLLMSettings: () => void;
  onToggleComponents: () => void;
  showPrompt: boolean;
  onTogglePrompt: () => void;
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
  onToggleComponents,
  showPrompt,
  onTogglePrompt,
  llmConfigured,
  llmReachable,
  busy,
}: ToolbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const llmLabel = !llmConfigured ? '○' : llmReachable ? '✓' : '!';
  const llmTitle = !llmConfigured
    ? 'LLM 未設定'
    : llmReachable
      ? 'llama-server 接続 OK'
      : 'llama-server に接続できません（npm run llama）';

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <h1 className="app-title">Prompt Studio</h1>
        <button
          type="button"
          className="btn-secondary"
          onClick={onToggleComponents}
          title="Prompt Components"
        >
          Components
        </button>
      </div>
      <div className="toolbar-center">
        <fieldset className="mode-fieldset">
          <legend className="mode-legend">Mode</legend>
          {exports.length === 0 && <span className="mode-empty">No modes</span>}
          {exports.map((item) => (
            <label key={item.id} className="mode-option">
              <input
                type="radio"
                name="mode"
                value={item.id}
                checked={selectedExport === item.id}
                disabled={busy}
                onChange={() => onExportChange(item.id)}
              />
              <span>{item.name}</span>
            </label>
          ))}
        </fieldset>
      </div>
      <div className="toolbar-right">
        <button type="button" className="btn-secondary" onClick={onTogglePrompt}>
          {showPrompt ? 'Hide Prompt' : 'Show Prompt'}
        </button>
        <div className="toolbar-menu" ref={menuRef}>
          <button
            type="button"
            className="btn-secondary btn-menu"
            title="More actions"
            onClick={() => setMenuOpen((open) => !open)}
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="toolbar-menu-dropdown">
              <button
                type="button"
                disabled={busy || !selectedExport}
                onClick={() => {
                  setMenuOpen(false);
                  onExportPrompt();
                }}
              >
                Export to workspace
                <kbd>Ctrl+Shift+E</kbd>
              </button>
            </div>
          )}
        </div>
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
          className="btn-primary btn-run-test"
          onClick={onRunTest}
          disabled={busy || !selectedExport}
        >
          RUN TEST
        </button>
      </div>
    </header>
  );
}
