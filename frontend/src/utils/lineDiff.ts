export type DiffLineType = 'same' | 'add' | 'remove';

export interface DiffLine {
  type: DiffLineType;
  text: string;
}

function lcsTable(a: string[], b: string[]): number[][] {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }

  return table;
}

export function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  if (oldText === newText) {
    return newText.split('\n').map((text) => ({ type: 'same', text }));
  }

  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const table = lcsTable(oldLines, newLines);
  const result: DiffLine[] = [];

  let i = oldLines.length;
  let j = newLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: 'same', text: oldLines[i - 1] });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      result.push({ type: 'add', text: newLines[j - 1] });
      j -= 1;
    } else if (i > 0) {
      result.push({ type: 'remove', text: oldLines[i - 1] });
      i -= 1;
    }
  }

  return result.reverse();
}

export function hasDiffChanges(lines: DiffLine[]): boolean {
  return lines.some((line) => line.type !== 'same');
}
