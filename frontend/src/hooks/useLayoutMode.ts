import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'prompt-studio-layout';

interface LayoutPrefs {
  showPrompt: boolean;
}

function loadPrefs(): LayoutPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { showPrompt: false };
    const parsed = JSON.parse(raw) as Partial<LayoutPrefs>;
    return { showPrompt: parsed.showPrompt === true };
  } catch {
    return { showPrompt: false };
  }
}

export function useLayoutMode() {
  const [showComponents, setShowComponents] = useState(false);
  const [showPrompt, setShowPrompt] = useState(loadPrefs);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ showPrompt }));
  }, [showPrompt]);

  const toggleComponents = useCallback(() => {
    setShowComponents((open) => !open);
  }, []);

  const closeComponents = useCallback(() => {
    setShowComponents(false);
  }, []);

  const togglePrompt = useCallback(() => {
    setShowPrompt((open) => !open);
  }, []);

  return {
    showComponents,
    showPrompt,
    toggleComponents,
    closeComponents,
    togglePrompt,
  };
}
