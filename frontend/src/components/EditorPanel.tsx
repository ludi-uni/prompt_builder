import { useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { MarkdownView } from './MarkdownView';
import type { SaveStatus } from '../hooks/useAutoSave';
import './EditorPanel.css';

interface EditorPanelProps {
  filename: string | null;
  content: string;
  saveStatus: SaveStatus;
  onChange: (content: string) => void;
  onFlushSave: () => Promise<boolean>;
  tab: 'edit' | 'preview';
  onTabChange: (tab: 'edit' | 'preview') => void;
}

function saveStatusLabel(status: SaveStatus): string | null {
  switch (status) {
    case 'pending':
      return 'Saving…';
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'Saved';
    case 'error':
      return 'Save failed';
    default:
      return null;
  }
}

export function EditorPanel({
  filename,
  content,
  saveStatus,
  onChange,
  onFlushSave,
  tab,
  onTabChange,
}: EditorPanelProps) {
  const statusLabel = saveStatusLabel(saveStatus);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (filename) void onFlushSave();
      }
    },
    [filename, onFlushSave],
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
              className={`save-status ${saveStatus === 'error' ? 'save-status-error' : ''}`}
            >
              {statusLabel}
            </span>
          )}
        </div>
        <div className="editor-tabs">
          <button
            type="button"
            className={tab === 'edit' ? 'active' : ''}
            onClick={() => onTabChange('edit')}
          >
            Edit
          </button>
          <button
            type="button"
            className={tab === 'preview' ? 'active' : ''}
            onClick={() => onTabChange('preview')}
          >
            Preview
          </button>
        </div>
      </div>
      <div className="editor-body">
        {tab === 'edit' ? (
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
        ) : (
          <div className="editor-preview">
            <MarkdownView content={content} />
          </div>
        )}
      </div>
    </section>
  );
}
