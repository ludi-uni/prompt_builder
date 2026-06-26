import type { LayerMeta } from '../api/client';

/** display_name → name → id */
export function getLayerDisplayName(layer: LayerMeta): string {
  return layer.display_name?.trim() || layer.name?.trim() || layer.id;
}
