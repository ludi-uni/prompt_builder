import { useCallback, useEffect, useState } from 'react';
import {
  collectImportableFiles,
  normalizeImportFilename,
  readFileAsText,
} from './utils/markdownFiles';
import { withRetry } from './utils/retry';
import { api, type ExportItem, type LayerMeta, type LLMConfig } from './api/client';
import { EditorPanel } from './components/EditorPanel';
import { LayersPanel } from './components/LayersPanel';
import { LLMSettingsModal } from './components/LLMSettingsModal';
import { PreviewPanel } from './components/PreviewPanel';
import { Toast } from './components/Toast';
import { Toolbar } from './components/Toolbar';
import './App.css';

function App() {
  const [layers, setLayers] = useState<LayerMeta[]>([]);
  const [exports, setExports] = useState<ExportItem[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [selectedExport, setSelectedExport] = useState<string | null>(null);
  const [builtPrompt, setBuiltPrompt] = useState('');
  const [previewMode, setPreviewMode] = useState<'rendered' | 'raw'>('rendered');
  const [editorTab, setEditorTab] = useState<'edit' | 'preview'>('edit');
  const [promptLoading, setPromptLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'error' | 'success' | 'info';
  } | null>(null);
  const [showLLMSettings, setShowLLMSettings] = useState(false);
  const [llmConfig, setLLMConfig] = useState<LLMConfig | null>(null);
  const [llmConfigured, setLLMConfigured] = useState(false);
  const [llmResponse, setLLMResponse] = useState<string | null>(null);
  const [llmLoading, setLLMLoading] = useState(false);

  const dirty = content !== savedContent;

  const showToast = useCallback(
    (message: string, type: 'error' | 'success' | 'info' = 'info') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 5000);
    },
    [],
  );

  const handleError = useCallback(
    (err: unknown, fallback: string) => {
      showToast(err instanceof Error ? err.message : fallback, 'error');
    },
    [showToast],
  );

  const refreshPrompt = useCallback(
    async (exportId: string | null) => {
      if (!exportId) {
        setBuiltPrompt('');
        return;
      }
      setPromptLoading(true);
      try {
        const result = await api.buildExport(exportId);
        setBuiltPrompt(result.prompt);
      } catch (err) {
        handleError(err, 'Failed to build prompt');
      } finally {
        setPromptLoading(false);
      }
    },
    [handleError],
  );

  const loadInitial = useCallback(async () => {
    try {
      const [layersRes, exportsRes, llmRes] = await withRetry(() =>
        Promise.all([api.listLayers(), api.listExports(), api.getLLMConfig()]),
      );
      setLayers(layersRes.layers);
      setExports(exportsRes.exports);
      setLLMConfigured(llmRes.configured);
      setLLMConfig(llmRes.config);

      if (layersRes.layers.length > 0) {
        const firstLayer = layersRes.layers[0].id;
        setSelectedLayerId(firstLayer);
        const filesRes = await api.listFiles(firstLayer);
        setFiles(filesRes.files);
        if (filesRes.files.length > 0) {
          const firstFile = filesRes.files[0];
          setSelectedFile(firstFile);
          const fileRes = await api.getFile(firstLayer, firstFile);
          setContent(fileRes.content);
          setSavedContent(fileRes.content);
        }
      }

      if (exportsRes.exports.length > 0) {
        const firstExport = exportsRes.exports[0].id;
        setSelectedExport(firstExport);
        await refreshPrompt(firstExport);
      }
    } catch (err) {
      handleError(err, 'Failed to load data');
    }
  }, [handleError, refreshPrompt]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const handleSelectLayer = async (layerId: string) => {
    setSelectedLayerId(layerId);
    setSelectedFile(null);
    setContent('');
    setSavedContent('');
    try {
      const filesRes = await api.listFiles(layerId);
      setFiles(filesRes.files);
      if (filesRes.files.length > 0) {
        await handleSelectFile(layerId, filesRes.files[0]);
      }
    } catch (err) {
      handleError(err, 'Failed to load layer files');
    }
  };

  const handleSelectFile = async (layerId: string, filename: string) => {
    if (
      dirty &&
      !window.confirm('You have unsaved changes. Continue without saving?')
    ) {
      return;
    }
    try {
      const fileRes = await api.getFile(layerId, filename);
      setSelectedFile(filename);
      setContent(fileRes.content);
      setSavedContent(fileRes.content);
    } catch (err) {
      handleError(err, 'Failed to load file');
    }
  };

  const handleSave = async () => {
    if (!selectedLayerId || !selectedFile) return;
    try {
      await api.saveFile(selectedLayerId, selectedFile, content);
      setSavedContent(content);
      showToast('Saved', 'success');
      await refreshPrompt(selectedExport);
    } catch (err) {
      handleError(err, 'Failed to save file');
    }
  };

  const handleCreateLayer = async (id: string, name: string, description: string) => {
    try {
      await api.createLayer({ id, name, description: description || undefined });
      const layersRes = await api.listLayers();
      setLayers(layersRes.layers);
      await handleSelectLayer(id);
      showToast(`Layer "${name}" created`, 'success');
    } catch (err) {
      handleError(err, 'Failed to create layer');
    }
  };

  const handleCreateFile = async (filename: string) => {
    if (!selectedLayerId) return;
    try {
      const result = await api.createFile(selectedLayerId, filename);
      const filesRes = await api.listFiles(selectedLayerId);
      setFiles(filesRes.files);
      await handleSelectFile(selectedLayerId, result.filename);
      showToast(`File "${result.filename}" created`, 'success');
    } catch (err) {
      handleError(err, 'Failed to create file');
    }
  };

  const handleImportFiles = async (incoming: File[]) => {
    if (!selectedLayerId) {
      showToast('Select a layer before importing files', 'error');
      return;
    }

    const importable = collectImportableFiles(incoming);
    if (importable.length === 0) {
      showToast('No importable files (.md, .markdown, .txt)', 'error');
      return;
    }

    let imported = 0;
    let skipped = 0;
    let lastImported: string | null = null;

    for (const file of importable) {
      let filename: string;
      try {
        filename = normalizeImportFilename(file.name);
      } catch {
        skipped += 1;
        continue;
      }

      const exists = files.includes(filename);
      if (exists) {
        const overwrite = window.confirm(`"${filename}" already exists. Overwrite?`);
        if (!overwrite) {
          skipped += 1;
          continue;
        }
      }

      try {
        const content = await readFileAsText(file);
        await api.createFile(selectedLayerId, filename, { content, overwrite: exists });
        imported += 1;
        lastImported = filename;
      } catch (err) {
        handleError(err, `Failed to import ${filename}`);
        skipped += 1;
      }
    }

    if (imported === 0) {
      if (skipped > 0) {
        showToast('No files were imported', 'info');
      }
      return;
    }

    const filesRes = await api.listFiles(selectedLayerId);
    setFiles(filesRes.files);
    if (lastImported) {
      await handleSelectFile(selectedLayerId, lastImported);
    }
    await refreshPrompt(selectedExport);

    const summary =
      skipped > 0
        ? `Imported ${imported} file(s), skipped ${skipped}`
        : `Imported ${imported} file(s)`;
    showToast(summary, 'success');
  };

  const handleDeleteFile = async (filename: string) => {
    if (!selectedLayerId) return;
    if (!window.confirm(`Delete ${filename}?`)) return;
    try {
      await api.deleteFile(selectedLayerId, filename);
      const filesRes = await api.listFiles(selectedLayerId);
      setFiles(filesRes.files);
      if (selectedFile === filename) {
        if (filesRes.files.length > 0) {
          await handleSelectFile(selectedLayerId, filesRes.files[0]);
        } else {
          setSelectedFile(null);
          setContent('');
          setSavedContent('');
        }
      }
      await refreshPrompt(selectedExport);
      showToast(`Deleted ${filename}`, 'success');
    } catch (err) {
      handleError(err, 'Failed to delete file');
    }
  };

  const handleDeleteLayer = async (layerId: string) => {
    const layer = layers.find((l) => l.id === layerId);
    const force = window.confirm(
      `Delete layer "${layer?.name ?? layerId}" and all its files?`,
    );
    if (!force) return;
    try {
      await api.deleteLayer(layerId, true);
      const layersRes = await api.listLayers();
      setLayers(layersRes.layers);
      if (selectedLayerId === layerId) {
        if (layersRes.layers.length > 0) {
          await handleSelectLayer(layersRes.layers[0].id);
        } else {
          setSelectedLayerId(null);
          setSelectedFile(null);
          setFiles([]);
          setContent('');
          setSavedContent('');
        }
      }
      showToast('Layer deleted', 'success');
    } catch (err) {
      handleError(err, 'Failed to delete layer');
    }
  };

  const handleExportChange = async (exportId: string) => {
    setSelectedExport(exportId);
    setLLMResponse(null);
    await refreshPrompt(exportId);
  };

  const handleExportPrompt = async () => {
    if (!selectedExport) return;
    setBusy(true);
    try {
      const result = await api.exportToWorkspace(selectedExport);
      await navigator.clipboard.writeText(result.prompt);
      showToast(`Exported to ${result.path} (copied to clipboard)`, 'success');
    } catch (err) {
      handleError(err, 'Failed to export prompt');
    } finally {
      setBusy(false);
    }
  };

  const handleRunTest = async () => {
    if (!selectedExport || !builtPrompt) return;
    setBusy(true);
    setLLMLoading(true);
    setLLMResponse(null);
    try {
      const result = await api.testLLM(builtPrompt);
      setLLMResponse(result.response);
      showToast('LLM test completed', 'success');
    } catch (err) {
      handleError(err, 'LLM test failed');
    } finally {
      setBusy(false);
      setLLMLoading(false);
    }
  };

  const handleSaveLLMConfig = async (config: LLMConfig) => {
    try {
      const result = await api.saveLLMConfig(config);
      setLLMConfig(result.config);
      setLLMConfigured(true);
      showToast('LLM settings saved', 'success');
    } catch (err) {
      handleError(err, 'Failed to save LLM settings');
      throw err;
    }
  };

  return (
    <div className="app">
      <Toolbar
        exports={exports}
        selectedExport={selectedExport}
        onExportChange={(id) => void handleExportChange(id)}
        onExportPrompt={() => void handleExportPrompt()}
        onRunTest={() => void handleRunTest()}
        onOpenLLMSettings={() => setShowLLMSettings(true)}
        llmConfigured={llmConfigured}
        busy={busy}
      />
      <main className="main-layout">
        <LayersPanel
          layers={layers}
          selectedLayerId={selectedLayerId}
          selectedFile={selectedFile}
          files={files}
          onSelectLayer={(id) => void handleSelectLayer(id)}
          onSelectFile={(file) => {
            if (selectedLayerId) void handleSelectFile(selectedLayerId, file);
          }}
          onCreateLayer={handleCreateLayer}
          onCreateFile={handleCreateFile}
          onImportFiles={handleImportFiles}
          onDeleteFile={(file) => handleDeleteFile(file)}
          onDeleteLayer={(id) => handleDeleteLayer(id)}
        />
        <EditorPanel
          filename={selectedFile}
          content={content}
          dirty={dirty}
          onChange={setContent}
          onSave={handleSave}
          tab={editorTab}
          onTabChange={setEditorTab}
        />
        <PreviewPanel
          prompt={builtPrompt}
          loading={promptLoading}
          mode={previewMode}
          onModeChange={setPreviewMode}
          llmResponse={llmResponse}
          llmLoading={llmLoading}
        />
      </main>
      {showLLMSettings && (
        <LLMSettingsModal
          config={llmConfig}
          onSave={handleSaveLLMConfig}
          onClose={() => setShowLLMSettings(false)}
        />
      )}
      <Toast
        message={toast?.message ?? null}
        type={toast?.type}
        onDismiss={() => setToast(null)}
      />
    </div>
  );
}

export default App;
