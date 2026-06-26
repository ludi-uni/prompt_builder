import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface UseAutoSaveOptions {
  layerId: string | null;
  filename: string | null;
  content: string;
  savedContent: string;
  setSavedContent: (content: string) => void;
  onAfterSave?: () => void | Promise<void>;
  debounceMs?: number;
}

export function useAutoSave({
  layerId,
  filename,
  content,
  savedContent,
  setSavedContent,
  onAfterSave,
  debounceMs = 500,
}: UseAutoSaveOptions) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveChainRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const contentRef = useRef(content);
  const savedContentRef = useRef(savedContent);

  contentRef.current = content;
  savedContentRef.current = savedContent;

  const isDirty = content !== savedContent;

  const flushSave = useCallback(async (): Promise<boolean> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const run = async (): Promise<boolean> => {
      const currentLayerId = layerId;
      const currentFilename = filename;
      const currentContent = contentRef.current;
      const currentSaved = savedContentRef.current;

      if (!currentLayerId || !currentFilename || currentContent === currentSaved) {
        return true;
      }

      setSaveStatus('saving');
      try {
        await api.saveFile(currentLayerId, currentFilename, currentContent);
        setSavedContent(currentContent);
        savedContentRef.current = currentContent;
        setSaveStatus('saved');
        await onAfterSave?.();
        return true;
      } catch {
        setSaveStatus('error');
        return false;
      }
    };

    saveChainRef.current = saveChainRef.current.then(run);
    return saveChainRef.current;
  }, [layerId, filename, setSavedContent, onAfterSave]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    setSaveStatus('pending');
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      void flushSave();
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [content, savedContent, isDirty, debounceMs, flushSave]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (contentRef.current !== savedContentRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(() => {
    if (saveStatus !== 'saved') return;
    const timer = setTimeout(() => setSaveStatus('idle'), 2000);
    return () => clearTimeout(timer);
  }, [saveStatus]);

  return { saveStatus, isDirty, flushSave };
}
