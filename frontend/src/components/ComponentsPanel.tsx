import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import type { BuildStep, LayerMeta } from '../api/client';
import { collectImportableFiles } from '../utils/markdownFiles';
import { getLayerDisplayName } from '../utils/displayName';
import {
  moveItem,
  orderedFilesForLayer,
  orderedLayersForBuild,
} from '../utils/exportBuild';
import './ComponentsPanel.css';

interface ComponentsPanelProps {
  layers: LayerMeta[];
  layerFiles: Record<string, string[]>;
  buildSteps: BuildStep[];
  canReorder: boolean;
  selectedLayerId: string | null;
  selectedFile: string | null;
  onSelectFile: (layerId: string, filename: string) => void;
  onReorderBuild: (build: BuildStep[]) => void;
  onCreateLayer: (
    id: string,
    name: string,
    displayName: string,
    description: string,
  ) => Promise<void>;
  onCreateFile: (layerId: string, filename: string) => Promise<void>;
  onImportFiles: (layerId: string, files: File[]) => Promise<void>;
  onDeleteFile: (layerId: string, filename: string) => Promise<void>;
  onDeleteLayer: (layerId: string) => Promise<void>;
}

export function ComponentsPanel({
  layers,
  layerFiles,
  buildSteps,
  canReorder,
  selectedLayerId,
  selectedFile,
  onSelectFile,
  onReorderBuild,
  onCreateLayer,
  onCreateFile,
  onImportFiles,
  onDeleteFile,
  onDeleteLayer,
}: ComponentsPanelProps) {
  const [showLayerModal, setShowLayerModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [fileModalLayerId, setFileModalLayerId] = useState<string | null>(null);
  const [importLayerId, setImportLayerId] = useState<string | null>(null);
  const [layerId, setLayerId] = useState('');
  const [layerDisplayName, setLayerDisplayName] = useState('');
  const [layerDesc, setLayerDesc] = useState('');
  const [newFilename, setNewFilename] = useState('');
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const orderedLayers = orderedLayersForBuild(layers, buildSteps);

  const moveLayer = (layerIdToMove: string, direction: 'up' | 'down') => {
    const index = buildSteps.findIndex((step) => step.layer === layerIdToMove);
    if (index < 0) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    onReorderBuild(moveItem(buildSteps, index, target));
  };

  const moveFile = (
    layerIdForFile: string,
    filename: string,
    direction: 'up' | 'down',
  ) => {
    const stepIndex = buildSteps.findIndex((step) => step.layer === layerIdForFile);
    if (stepIndex < 0) return;
    const step = buildSteps[stepIndex];
    const fileIndex = step.prompts.indexOf(filename);
    if (fileIndex < 0) return;
    const target = direction === 'up' ? fileIndex - 1 : fileIndex + 1;
    const nextPrompts = moveItem(step.prompts, fileIndex, target);
    const nextBuild = buildSteps.map((s, i) =>
      i === stepIndex ? { ...s, prompts: nextPrompts } : s,
    );
    onReorderBuild(nextBuild);
  };

  const isFileInBuild = (layerIdForFile: string, filename: string) => {
    const step = buildSteps.find((s) => s.layer === layerIdForFile);
    return step?.prompts.includes(filename) ?? false;
  };

  const handleCreateLayer = async () => {
    if (!layerId.trim() || !layerDisplayName.trim()) return;
    const displayName = layerDisplayName.trim();
    await onCreateLayer(layerId.trim(), displayName, displayName, layerDesc.trim());
    setShowLayerModal(false);
    setLayerId('');
    setLayerDisplayName('');
    setLayerDesc('');
  };

  const openFileModal = (targetLayerId: string) => {
    setFileModalLayerId(targetLayerId);
    setShowFileModal(true);
  };

  const handleCreateFile = async () => {
    if (!fileModalLayerId || !newFilename.trim()) return;
    await onCreateFile(fileModalLayerId, newFilename.trim());
    setShowFileModal(false);
    setFileModalLayerId(null);
    setNewFilename('');
  };

  const handleIncomingFiles = async (
    targetLayerId: string,
    incoming: FileList | File[],
  ) => {
    const importable = collectImportableFiles(incoming);
    if (importable.length === 0) return;
    setImporting(true);
    try {
      await onImportFiles(targetLayerId, importable);
    } finally {
      setImporting(false);
      setDragOverLayerId(null);
      setImportLayerId(null);
    }
  };

  const onDragEnter = (e: DragEvent, layerIdForDrop: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setDragOverLayerId(layerIdForDrop);
    }
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setDragOverLayerId(null);
    }
  };

  const onDrop = (e: DragEvent, layerIdForDrop: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverLayerId(null);
    void handleIncomingFiles(layerIdForDrop, e.dataTransfer.files);
  };

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const targetLayer = importLayerId;
    if (e.target.files && e.target.files.length > 0 && targetLayer) {
      void handleIncomingFiles(targetLayer, e.target.files);
    }
    e.target.value = '';
    setImportLayerId(null);
  };

  return (
    <aside className={`components-panel ${importing ? 'importing' : ''}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        multiple
        hidden
        onChange={onFileInputChange}
      />

      <div className="panel-header">
        <div>
          <h2>Prompt Components</h2>
          {canReorder && <p className="panel-hint">↑↓ で現在の Mode の結合順を変更</p>}
        </div>
        <button
          type="button"
          className="btn-icon"
          title="Add component"
          onClick={() => setShowLayerModal(true)}
        >
          +
        </button>
      </div>

      <ul className="component-list">
        {orderedLayers.map((layer) => {
          const layerMeta = layers.find((l) => l.id === layer.id);
          if (!layerMeta) return null;

          const allFiles = layerFiles[layer.id] ?? [];
          const files = orderedFilesForLayer(layer.id, allFiles, buildSteps);
          const isDragTarget = dragOverLayerId === layer.id;
          const buildIndex = buildSteps.findIndex((step) => step.layer === layer.id);
          const inBuild = buildIndex >= 0;

          return (
            <li
              key={layer.id}
              className={`component-group ${isDragTarget ? 'drag-over' : ''}`}
              onDragEnter={(e) => onDragEnter(e, layer.id)}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, layer.id)}
            >
              <div className="component-header">
                {canReorder && inBuild && (
                  <div className="reorder-btns reorder-btns-vertical">
                    <button
                      type="button"
                      className="btn-reorder"
                      title="Move component up"
                      disabled={buildIndex === 0}
                      onClick={() => moveLayer(layer.id, 'up')}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn-reorder"
                      title="Move component down"
                      disabled={buildIndex === buildSteps.length - 1}
                      onClick={() => moveLayer(layer.id, 'down')}
                    >
                      ↓
                    </button>
                  </div>
                )}
                <div className="component-title">
                  <span className="component-name">
                    {getLayerDisplayName(layerMeta)}
                  </span>
                  {layerMeta.description && (
                    <span className="component-desc">{layerMeta.description}</span>
                  )}
                  {!inBuild && canReorder && (
                    <span className="component-desc">この Mode では未使用</span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-icon btn-danger"
                  title="Delete component"
                  onClick={() => onDeleteLayer(layer.id)}
                >
                  ×
                </button>
              </div>

              {isDragTarget && (
                <div className="drop-hint">Drop .md files here to import</div>
              )}

              <ul className="file-list">
                {files.map((file) => {
                  const inMode = isFileInBuild(layer.id, file);
                  const step = buildSteps.find((s) => s.layer === layer.id);
                  const fileIndex = step?.prompts.indexOf(file) ?? -1;

                  return (
                    <li
                      key={file}
                      className={
                        selectedLayerId === layer.id && selectedFile === file
                          ? 'active'
                          : ''
                      }
                    >
                      {canReorder && inMode && (
                        <div className="reorder-btns">
                          <button
                            type="button"
                            className="btn-reorder"
                            title="Move prompt up"
                            disabled={fileIndex <= 0}
                            onClick={() => moveFile(layer.id, file, 'up')}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="btn-reorder"
                            title="Move prompt down"
                            disabled={!step || fileIndex >= step.prompts.length - 1}
                            onClick={() => moveFile(layer.id, file, 'down')}
                          >
                            ↓
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        className={`file-btn ${!inMode ? 'file-btn-muted' : ''}`}
                        onClick={() => onSelectFile(layer.id, file)}
                      >
                        {file}
                      </button>
                      <button
                        type="button"
                        className="btn-icon btn-danger"
                        title="Delete file"
                        onClick={() => onDeleteFile(layer.id, file)}
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
                <li className="file-actions">
                  <button
                    type="button"
                    className="add-file-btn"
                    onClick={() => openFileModal(layer.id)}
                  >
                    + New file
                  </button>
                  <button
                    type="button"
                    className="add-file-btn import-file-btn"
                    disabled={importing}
                    onClick={() => {
                      setImportLayerId(layer.id);
                      fileInputRef.current?.click();
                    }}
                  >
                    Import files…
                  </button>
                </li>
              </ul>
            </li>
          );
        })}
      </ul>

      {showLayerModal && (
        <div className="modal-overlay" onClick={() => setShowLayerModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>New Component</h3>
            <label>
              ID (lowercase, internal)
              <input
                value={layerId}
                onChange={(e) => setLayerId(e.target.value)}
                placeholder="e.g. worldview"
              />
            </label>
            <label>
              Display name
              <input
                value={layerDisplayName}
                onChange={(e) => setLayerDisplayName(e.target.value)}
                placeholder="e.g. 🌍 世界観"
              />
            </label>
            <label>
              Description
              <input
                value={layerDesc}
                onChange={(e) => setLayerDesc(e.target.value)}
                placeholder="Optional"
              />
            </label>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowLayerModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void handleCreateLayer()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showFileModal && (
        <div className="modal-overlay" onClick={() => setShowFileModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>New File</h3>
            <label>
              Filename
              <input
                value={newFilename}
                onChange={(e) => setNewFilename(e.target.value)}
                placeholder="e.g. identity.md"
              />
            </label>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowFileModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void handleCreateFile()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
