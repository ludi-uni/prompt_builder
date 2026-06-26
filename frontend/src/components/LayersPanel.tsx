import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import type { LayerMeta } from '../api/client';
import { collectImportableFiles } from '../utils/markdownFiles';
import './LayersPanel.css';

interface LayersPanelProps {
  layers: LayerMeta[];
  selectedLayerId: string | null;
  selectedFile: string | null;
  files: string[];
  onSelectLayer: (layerId: string) => void;
  onSelectFile: (filename: string) => void;
  onCreateLayer: (id: string, name: string, description: string) => Promise<void>;
  onCreateFile: (filename: string) => Promise<void>;
  onImportFiles: (files: File[]) => Promise<void>;
  onDeleteFile: (filename: string) => Promise<void>;
  onDeleteLayer: (layerId: string) => Promise<void>;
}

export function LayersPanel({
  layers,
  selectedLayerId,
  selectedFile,
  files,
  onSelectLayer,
  onSelectFile,
  onCreateLayer,
  onCreateFile,
  onImportFiles,
  onDeleteFile,
  onDeleteLayer,
}: LayersPanelProps) {
  const [showLayerModal, setShowLayerModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [layerId, setLayerId] = useState('');
  const [layerName, setLayerName] = useState('');
  const [layerDesc, setLayerDesc] = useState('');
  const [newFilename, setNewFilename] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateLayer = async () => {
    if (!layerId.trim() || !layerName.trim()) return;
    await onCreateLayer(layerId.trim(), layerName.trim(), layerDesc.trim());
    setShowLayerModal(false);
    setLayerId('');
    setLayerName('');
    setLayerDesc('');
  };

  const handleCreateFile = async () => {
    if (!newFilename.trim()) return;
    await onCreateFile(newFilename.trim());
    setShowFileModal(false);
    setNewFilename('');
  };

  const handleIncomingFiles = async (incoming: FileList | File[]) => {
    const importable = collectImportableFiles(incoming);
    if (importable.length === 0) return;
    setImporting(true);
    try {
      await onImportFiles(importable);
    } finally {
      setImporting(false);
      setDragOver(false);
    }
  };

  const onDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setDragOver(true);
    }
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = selectedLayerId ? 'copy' : 'none';
  };

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setDragOver(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (!selectedLayerId) return;
    void handleIncomingFiles(e.dataTransfer.files);
  };

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void handleIncomingFiles(e.target.files);
    }
    e.target.value = '';
  };

  return (
    <aside
      className={`layers-panel ${dragOver ? 'drag-over' : ''} ${importing ? 'importing' : ''}`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        multiple
        hidden
        onChange={onFileInputChange}
      />

      <div className="panel-header">
        <h2>Layers</h2>
        <button
          type="button"
          className="btn-icon"
          title="Add layer"
          onClick={() => setShowLayerModal(true)}
        >
          +
        </button>
      </div>

      {dragOver && (
        <div className="drop-overlay">
          {selectedLayerId
            ? 'Drop .md files here to import'
            : 'Select a layer first, then drop files'}
        </div>
      )}

      <ul className="layer-list">
        {layers.map((layer) => (
          <li key={layer.id} className={selectedLayerId === layer.id ? 'active' : ''}>
            <div className="layer-row">
              <button
                type="button"
                className="layer-btn"
                onClick={() => onSelectLayer(layer.id)}
              >
                <span className="layer-name">{layer.name}</span>
                {layer.description && (
                  <span className="layer-desc">{layer.description}</span>
                )}
              </button>
              <button
                type="button"
                className="btn-icon btn-danger"
                title="Delete layer"
                onClick={() => onDeleteLayer(layer.id)}
              >
                ×
              </button>
            </div>
            {selectedLayerId === layer.id && (
              <ul className="file-list">
                {files.map((file) => (
                  <li key={file} className={selectedFile === file ? 'active' : ''}>
                    <button
                      type="button"
                      className="file-btn"
                      onClick={() => onSelectFile(file)}
                    >
                      {file}
                    </button>
                    <button
                      type="button"
                      className="btn-icon btn-danger"
                      title="Delete file"
                      onClick={() => onDeleteFile(file)}
                    >
                      ×
                    </button>
                  </li>
                ))}
                <li className="file-actions">
                  <button
                    type="button"
                    className="add-file-btn"
                    onClick={() => setShowFileModal(true)}
                  >
                    + New file
                  </button>
                  <button
                    type="button"
                    className="add-file-btn import-file-btn"
                    disabled={importing}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Import files…
                  </button>
                </li>
              </ul>
            )}
          </li>
        ))}
      </ul>

      {showLayerModal && (
        <div className="modal-overlay" onClick={() => setShowLayerModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>New Layer</h3>
            <label>
              ID (lowercase)
              <input
                value={layerId}
                onChange={(e) => setLayerId(e.target.value)}
                placeholder="e.g. persona"
              />
            </label>
            <label>
              Name
              <input
                value={layerName}
                onChange={(e) => setLayerName(e.target.value)}
                placeholder="e.g. Persona"
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
              <button type="button" className="btn-primary" onClick={handleCreateLayer}>
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
              <button type="button" className="btn-primary" onClick={handleCreateFile}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
