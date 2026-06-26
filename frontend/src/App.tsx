import { useCallback, useEffect, useState } from 'react';
import {
  collectImportableFiles,
  normalizeImportFilename,
  readFileAsText,
} from './utils/markdownFiles';
import { withRetry } from './utils/retry';
import {
  api,
  type BuildStep,
  type ExportConfig,
  type ExportItem,
  type LayerMeta,
  type LLMConfig,
  type LLMUsage,
} from './api/client';
import { ComponentsPanel } from './components/ComponentsPanel';
import { EditorPanel } from './components/EditorPanel';
import { LLMSettingsModal } from './components/LLMSettingsModal';
import { PromptPanel } from './components/PromptPanel';
import { TestResultPanel } from './components/TestResultPanel';
import { Toast } from './components/Toast';
import { Toolbar } from './components/Toolbar';
import { useAutoSave } from './hooks/useAutoSave';
import { useLayoutMode } from './hooks/useLayoutMode';
import { getLayerDisplayName } from './utils/displayName';
import { appendFileToBuild, removeFileFromBuild } from './utils/exportBuild';
import './App.css';

async function fetchAllLayerFiles(
  layers: LayerMeta[],
): Promise<Record<string, string[]>> {
  const entries = await Promise.all(
    layers.map(async (layer) => {
      const result = await api.listFiles(layer.id);
      return [layer.id, result.files] as const;
    }),
  );
  return Object.fromEntries(entries);
}

function App() {
  const [layers, setLayers] = useState<LayerMeta[]>([]);
  const [exports, setExports] = useState<ExportItem[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [layerFiles, setLayerFiles] = useState<Record<string, string[]>>({});
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [selectedExport, setSelectedExport] = useState<string | null>(null);
  const [exportConfig, setExportConfig] = useState<ExportConfig | null>(null);
  const [builtPrompt, setBuiltPrompt] = useState('');
  const [previousPrompt, setPreviousPrompt] = useState('');
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
  const [llmReachable, setLLMReachable] = useState(false);
  const [llmResponse, setLLMResponse] = useState<string | null>(null);
  const [llmUsage, setLLMUsage] = useState<LLMUsage | null>(null);
  const [llmLoading, setLLMLoading] = useState(false);

  const {
    showComponents,
    showPrompt,
    toggleComponents,
    closeComponents,
    togglePrompt,
  } = useLayoutMode();

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

  const loadExportConfig = useCallback(
    async (exportId: string | null) => {
      if (!exportId) {
        setExportConfig(null);
        return;
      }
      try {
        const config = await api.getExport(exportId);
        setExportConfig(config);
      } catch (err) {
        handleError(err, 'Failed to load mode configuration');
      }
    },
    [handleError],
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
        setBuiltPrompt((prev) => {
          if (prev && prev !== result.prompt) {
            setPreviousPrompt(prev);
          }
          return result.prompt;
        });
      } catch (err) {
        handleError(err, 'Failed to build prompt');
      } finally {
        setPromptLoading(false);
      }
    },
    [handleError],
  );

  const { saveStatus, flushSave } = useAutoSave({
    layerId: selectedLayerId,
    filename: selectedFile,
    content,
    savedContent,
    setSavedContent,
    onAfterSave: () => refreshPrompt(selectedExport),
  });

  const refreshLayerFiles = useCallback(async (layerList: LayerMeta[]) => {
    if (layerList.length === 0) {
      setLayerFiles({});
      return;
    }
    setLayerFiles(await fetchAllLayerFiles(layerList));
  }, []);

  const refreshLLMHealth = useCallback(async (serverUrl?: string) => {
    try {
      const health = await api.checkLLMHealth(serverUrl);
      setLLMReachable(health.reachable);
    } catch {
      setLLMReachable(false);
    }
  }, []);

  const loadInitial = useCallback(async () => {
    try {
      const [layersRes, exportsRes, llmRes] = await withRetry(() =>
        Promise.all([api.listLayers(), api.listExports(), api.getLLMConfig()]),
      );
      setLayers(layersRes.layers);
      setExports(exportsRes.exports);
      setLLMConfigured(llmRes.configured);
      setLLMConfig(llmRes.config);
      void refreshLLMHealth(llmRes.config?.server_url);
      await refreshLayerFiles(layersRes.layers);

      if (layersRes.layers.length > 0) {
        const firstLayer = layersRes.layers[0].id;
        const files = (await api.listFiles(firstLayer)).files;
        if (files.length > 0) {
          const firstFile = files[0];
          setSelectedLayerId(firstLayer);
          setSelectedFile(firstFile);
          const fileRes = await api.getFile(firstLayer, firstFile);
          setContent(fileRes.content);
          setSavedContent(fileRes.content);
        }
      }

      if (exportsRes.exports.length > 0) {
        const firstExport = exportsRes.exports[0].id;
        setSelectedExport(firstExport);
        await loadExportConfig(firstExport);
        await refreshPrompt(firstExport);
      }
    } catch (err) {
      handleError(err, 'Failed to load data');
    }
  }, [
    handleError,
    refreshPrompt,
    refreshLLMHealth,
    refreshLayerFiles,
    loadExportConfig,
  ]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const handleSelectFile = useCallback(
    async (layerId: string, filename: string, closeDrawer = true) => {
      await flushSave();
      try {
        const fileRes = await api.getFile(layerId, filename);
        setSelectedLayerId(layerId);
        setSelectedFile(filename);
        setContent(fileRes.content);
        setSavedContent(fileRes.content);
        if (closeDrawer) {
          closeComponents();
        }
      } catch (err) {
        handleError(err, 'Failed to load file');
      }
    },
    [flushSave, closeComponents, handleError],
  );

  const handleCreateLayer = async (
    id: string,
    name: string,
    displayName: string,
    description: string,
  ) => {
    try {
      await api.createLayer({
        id,
        name,
        display_name: displayName,
        description: description || undefined,
      });
      const layersRes = await api.listLayers();
      setLayers(layersRes.layers);
      await refreshLayerFiles(layersRes.layers);
      showToast(`Component "${displayName}" created`, 'success');
    } catch (err) {
      handleError(err, 'Failed to create component');
    }
  };

  const handleUpdateExportBuild = useCallback(
    async (build: BuildStep[]) => {
      if (!selectedExport || !exportConfig) return;
      const nextConfig: ExportConfig = { ...exportConfig, build };
      try {
        const saved = await api.updateExport(selectedExport, nextConfig);
        setExportConfig(saved);
        await refreshPrompt(selectedExport);
      } catch (err) {
        handleError(err, 'Failed to update prompt order');
      }
    },
    [selectedExport, exportConfig, refreshPrompt, handleError],
  );

  const handleCreateFile = async (layerId: string, filename: string) => {
    try {
      const result = await api.createFile(layerId, filename);
      if (selectedExport && exportConfig) {
        const nextBuild = appendFileToBuild(
          exportConfig.build,
          layerId,
          result.filename,
        );
        await api.updateExport(selectedExport, { ...exportConfig, build: nextBuild });
        setExportConfig((prev) => (prev ? { ...prev, build: nextBuild } : prev));
      }
      const layersRes = await api.listLayers();
      await refreshLayerFiles(layersRes.layers);
      await handleSelectFile(layerId, result.filename, false);
      await refreshPrompt(selectedExport);
      showToast(`File "${result.filename}" created`, 'success');
    } catch (err) {
      handleError(err, 'Failed to create file');
    }
  };

  const handleImportFiles = async (layerId: string, incoming: File[]) => {
    const importable = collectImportableFiles(incoming);
    if (importable.length === 0) {
      showToast('No importable files (.md, .markdown, .txt)', 'error');
      return;
    }

    const existingFiles = layerFiles[layerId] ?? [];
    let imported = 0;
    let skipped = 0;
    let lastImported: string | null = null;
    let nextBuild = exportConfig?.build;

    for (const file of importable) {
      let filename: string;
      try {
        filename = normalizeImportFilename(file.name);
      } catch {
        skipped += 1;
        continue;
      }

      const exists = existingFiles.includes(filename);
      if (exists) {
        const overwrite = window.confirm(`"${filename}" already exists. Overwrite?`);
        if (!overwrite) {
          skipped += 1;
          continue;
        }
      }

      try {
        const fileContent = await readFileAsText(file);
        await api.createFile(layerId, filename, {
          content: fileContent,
          overwrite: exists,
        });
        if (nextBuild && !exists) {
          nextBuild = appendFileToBuild(nextBuild, layerId, filename);
        }
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

    if (selectedExport && exportConfig && nextBuild) {
      await api.updateExport(selectedExport, { ...exportConfig, build: nextBuild });
      setExportConfig({ ...exportConfig, build: nextBuild });
    }

    const layersRes = await api.listLayers();
    await refreshLayerFiles(layersRes.layers);
    if (lastImported) {
      await handleSelectFile(layerId, lastImported, false);
    }
    await refreshPrompt(selectedExport);

    const summary =
      skipped > 0
        ? `Imported ${imported} file(s), skipped ${skipped}`
        : `Imported ${imported} file(s)`;
    showToast(summary, 'success');
  };

  const handleDeleteFile = async (layerId: string, filename: string) => {
    if (!window.confirm(`Delete ${filename}?`)) return;
    try {
      await api.deleteFile(layerId, filename);
      if (selectedExport && exportConfig) {
        const nextBuild = removeFileFromBuild(exportConfig.build, layerId, filename);
        await api.updateExport(selectedExport, { ...exportConfig, build: nextBuild });
        setExportConfig((prev) => (prev ? { ...prev, build: nextBuild } : prev));
      }
      const layersRes = await api.listLayers();
      await refreshLayerFiles(layersRes.layers);
      if (selectedLayerId === layerId && selectedFile === filename) {
        const remaining = (await api.listFiles(layerId)).files;
        if (remaining.length > 0) {
          await handleSelectFile(layerId, remaining[0], false);
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
      `Delete component "${layer ? getLayerDisplayName(layer) : layerId}" and all its files?`,
    );
    if (!force) return;
    try {
      await api.deleteLayer(layerId, true);
      const layersRes = await api.listLayers();
      setLayers(layersRes.layers);
      await refreshLayerFiles(layersRes.layers);
      if (selectedLayerId === layerId) {
        if (layersRes.layers.length > 0) {
          const nextLayer = layersRes.layers[0].id;
          const nextFiles = (await api.listFiles(nextLayer)).files;
          if (nextFiles.length > 0) {
            await handleSelectFile(nextLayer, nextFiles[0], false);
          } else {
            setSelectedLayerId(nextLayer);
            setSelectedFile(null);
            setContent('');
            setSavedContent('');
          }
        } else {
          setSelectedLayerId(null);
          setSelectedFile(null);
          setContent('');
          setSavedContent('');
        }
      }
      showToast('Component deleted', 'success');
    } catch (err) {
      handleError(err, 'Failed to delete component');
    }
  };

  const handleExportChange = async (exportId: string) => {
    await flushSave();
    setSelectedExport(exportId);
    setLLMResponse(null);
    setLLMUsage(null);
    await loadExportConfig(exportId);
    await refreshPrompt(exportId);
  };

  const handleExportPrompt = useCallback(async () => {
    if (!selectedExport) return;
    setBusy(true);
    try {
      await flushSave();
      const result = await api.exportToWorkspace(selectedExport);
      await navigator.clipboard.writeText(result.prompt);
      showToast(`Exported to ${result.path} (copied to clipboard)`, 'success');
    } catch (err) {
      handleError(err, 'Failed to export prompt');
    } finally {
      setBusy(false);
    }
  }, [selectedExport, showToast, handleError, flushSave]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if (selectedExport && !busy) void handleExportPrompt();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedExport, busy, handleExportPrompt]);

  const handleRunTest = async () => {
    if (!selectedExport || !builtPrompt) return;
    setBusy(true);
    setLLMLoading(true);
    setLLMResponse(null);
    setLLMUsage(null);
    try {
      await flushSave();
      const result = await api.testLLM(builtPrompt);
      setLLMResponse(result.response);
      setLLMUsage(result.usage);
      setLLMReachable(true);
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
      await refreshLLMHealth(config.server_url);
      showToast('LLM settings saved', 'success');
    } catch (err) {
      handleError(err, 'Failed to save LLM settings');
      throw err;
    }
  };

  const layoutClass = showPrompt ? 'layout-detail' : 'layout-focus';

  return (
    <div className="app">
      <Toolbar
        exports={exports}
        selectedExport={selectedExport}
        onExportChange={(id) => void handleExportChange(id)}
        onExportPrompt={() => void handleExportPrompt()}
        onRunTest={() => void handleRunTest()}
        onOpenLLMSettings={() => setShowLLMSettings(true)}
        onToggleComponents={toggleComponents}
        showPrompt={showPrompt}
        onTogglePrompt={togglePrompt}
        llmConfigured={llmConfigured}
        llmReachable={llmReachable}
        busy={busy}
      />
      {showComponents && (
        <>
          <button
            type="button"
            className="drawer-backdrop"
            aria-label="Close components"
            onClick={closeComponents}
          />
          <div className="components-drawer">
            <ComponentsPanel
              layers={layers}
              layerFiles={layerFiles}
              buildSteps={exportConfig?.build ?? []}
              canReorder={Boolean(selectedExport && exportConfig)}
              selectedLayerId={selectedLayerId}
              selectedFile={selectedFile}
              onSelectFile={(layerId, file) => void handleSelectFile(layerId, file)}
              onReorderBuild={(build) => void handleUpdateExportBuild(build)}
              onCreateLayer={handleCreateLayer}
              onCreateFile={handleCreateFile}
              onImportFiles={handleImportFiles}
              onDeleteFile={(layerId, file) => void handleDeleteFile(layerId, file)}
              onDeleteLayer={(id) => void handleDeleteLayer(id)}
            />
          </div>
        </>
      )}
      <main className={`main-layout ${layoutClass}`}>
        <EditorPanel
          filename={selectedFile}
          content={content}
          saveStatus={saveStatus}
          onChange={setContent}
          onFlushSave={flushSave}
          tab={editorTab}
          onTabChange={setEditorTab}
        />
        {showPrompt && (
          <PromptPanel
            prompt={builtPrompt}
            previousPrompt={previousPrompt}
            exports={exports}
            selectedExport={selectedExport}
            loading={promptLoading}
            mode={previewMode}
            onModeChange={setPreviewMode}
          />
        )}
        <TestResultPanel
          inputPrompt={builtPrompt}
          llmResponse={llmResponse}
          llmUsage={llmUsage}
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
