import { useCallback, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { MarkdownView } from './MarkdownView'
import './EditorPanel.css'

interface EditorPanelProps {
  filename: string | null
  content: string
  dirty: boolean
  onChange: (content: string) => void
  onSave: () => Promise<void>
  tab: 'edit' | 'preview'
  onTabChange: (tab: 'edit' | 'preview') => void
}

export function EditorPanel({
  filename,
  content,
  dirty,
  onChange,
  onSave,
  tab,
  onTabChange,
}: EditorPanelProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (filename && dirty) void onSave()
      }
    },
    [filename, dirty, onSave],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!filename) {
    return (
      <section className="editor-panel empty">
        <p>Select a file from the layers panel to edit.</p>
      </section>
    )
  }

  return (
    <section className="editor-panel">
      <div className="editor-header">
        <div className="editor-title">
          <span className="filename">{filename}</span>
          {dirty && <span className="dirty-badge">unsaved</span>}
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
          <button
            type="button"
            className="btn-save"
            disabled={!dirty}
            onClick={() => void onSave()}
          >
            Save
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
  )
}
