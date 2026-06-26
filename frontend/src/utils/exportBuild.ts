import type { BuildStep } from '../api/client';

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) {
    return items;
  }
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function orderedFilesForLayer(
  layerId: string,
  allFiles: string[],
  build: BuildStep[],
): string[] {
  const step = build.find((s) => s.layer === layerId);
  if (!step) {
    return [...allFiles].sort();
  }
  const inBuild = step.prompts.filter((f) => allFiles.includes(f));
  const rest = allFiles.filter((f) => !step.prompts.includes(f)).sort();
  return [...inBuild, ...rest];
}

export function orderedLayersForBuild(
  layers: { id: string }[],
  build: BuildStep[],
): { id: string }[] {
  const buildOrder = build.map((s) => s.layer);
  const inBuild = buildOrder
    .map((id) => layers.find((l) => l.id === id))
    .filter((l): l is { id: string } => l !== undefined);
  const rest = layers.filter((l) => !buildOrder.includes(l.id));
  return [...inBuild, ...rest];
}

export function appendFileToBuild(
  build: BuildStep[],
  layerId: string,
  filename: string,
): BuildStep[] {
  const next = build.map((step) => ({ ...step, prompts: [...step.prompts] }));
  const step = next.find((s) => s.layer === layerId);
  if (step) {
    if (!step.prompts.includes(filename)) {
      step.prompts.push(filename);
    }
    return next;
  }
  return [...next, { layer: layerId, prompts: [filename] }];
}

export function removeFileFromBuild(
  build: BuildStep[],
  layerId: string,
  filename: string,
): BuildStep[] {
  return build
    .map((step) =>
      step.layer === layerId
        ? { ...step, prompts: step.prompts.filter((f) => f !== filename) }
        : step,
    )
    .filter((step) => step.prompts.length > 0);
}
