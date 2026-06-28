import { useCallback, useState } from 'react';

export function useLayoutMode() {
  const [showComponents, setShowComponents] = useState(false);

  const toggleComponents = useCallback(() => {
    setShowComponents((open) => !open);
  }, []);

  const closeComponents = useCallback(() => {
    setShowComponents(false);
  }, []);

  return {
    showComponents,
    toggleComponents,
    closeComponents,
  };
}
