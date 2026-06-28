import { useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import type { SaveStatus } from '../hooks/useManualSave';
import './EditorPanel.css';

interface EditorPanelProps {
  filename: string | null;
  content: string;
  saveStatus: SaveStatus;
  isDirty: boolean;
  onChange: (content: string) => void;
  onFlushSave: () => Promise<boolean>;
}

function saveStatusLabel(status: SaveStatus, isDirty: boolean): string | null {
  if (status === 'saving') return 'Saving…';
  if (status === 'saved') return 'Saved';
  if (status === 'error') return 'Save failed';
  if (isDirty) return 'Unsaved';
  return null;
}

export function EditorPanel({
  filename,
  content,
  saveStatus,
  isDirty,
  onChange,
  onFlushSave,
}: EditorPanelProps) {
  const statusLabel = saveStatusLabel(saveStatus, isDirty);
  const canSave = isDirty && saveStatus !== 'saving';

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (filename && canSave) void onFlushSave();
      }
    },
    [filename, canSave, onFlushSave],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!filename) {
    return (
      <section className="editor-panel empty">
        <p>Select a prompt component file to edit.</p>
      </section>
    );
  }

  return (
    <section className="editor-panel">
      <div className="editor-header">
        <div className="editor-title">
          <span className="filename">{filename}</span>
          {statusLabel && (
            <span
              className={`save-status ${
                saveStatus === 'error'
                  ? 'save-status-error'
                  : isDirty
                    ? 'save-status-dirty'
                    : ''
              }`}
            >
              {statusLabel}
            </span>
          )}
        </div>
        <button
          type="button"
          className="btn-save"
          disabled={!canSave}
          title="Save (Ctrl+S)"
          onClick={() => void onFlushSave()}
        >
          Save
        </button>
      </div>
      <div className="editor-body">
        <Editor
          height="100%"
          defaultLanguage="markdown"
          value={content}
          onChange={(value) => onChange(value ?? '')}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            wordWrap: 'on',
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      </div>
    </section>
  );
}
