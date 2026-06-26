const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.txt'])

export function normalizeImportFilename(name: string): string {
  const base = name.replace(/\\/g, '/').split('/').pop()?.trim() ?? ''
  if (!base) {
    throw new Error('Invalid filename')
  }
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  const ext = dot > 0 ? base.slice(dot).toLowerCase() : ''
  if (!stem) {
    throw new Error('Invalid filename')
  }
  if (ext === '.txt' || ext === '.markdown' || ext === '') {
    return `${stem}.md`
  }
  if (ext === '.md') {
    return `${stem}.md`
  }
  throw new Error(`Unsupported file type: ${base}`)
}

export function isImportableMarkdownFile(file: File): boolean {
  const name = file.name.toLowerCase()
  const dot = name.lastIndexOf('.')
  const ext = dot >= 0 ? name.slice(dot) : ''
  return MARKDOWN_EXTENSIONS.has(ext)
}

export function collectImportableFiles(fileList: FileList | File[]): File[] {
  const files = Array.from(fileList).filter(isImportableMarkdownFile)
  const seen = new Set<string>()
  const unique: File[] = []
  for (const file of files) {
    const key = normalizeImportFilename(file.name)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(file)
  }
  return unique
}

export async function readFileAsText(file: File): Promise<string> {
  return file.text()
}
