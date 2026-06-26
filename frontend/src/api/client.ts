export interface LayerMeta {
  id: string;
  name: string;
  display_name?: string | null;
  description?: string;
}

export interface ExportItem {
  id: string;
  name: string;
}

export interface LLMConfig {
  server_url: string;
  timeout_seconds: number;
}

export interface LLMUsage {
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  tps: number | null;
  ttft_ms: number | null;
  total_ms: number | null;
}

export interface LLMTestResult {
  response: string;
  usage: LLMUsage | null;
}

export interface LLMHealth {
  configured: boolean;
  reachable: boolean;
  server_url: string | null;
  error: string | null;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail ?? JSON.stringify(body);
    } catch {
      // ignore
    }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string }>('/api/health'),

  listLayers: () => request<{ layers: LayerMeta[] }>('/api/layers'),
  createLayer: (body: {
    id: string;
    name: string;
    display_name?: string;
    description?: string;
  }) =>
    request<LayerMeta>('/api/layers', { method: 'POST', body: JSON.stringify(body) }),
  deleteLayer: (id: string, force = false) =>
    request<{ deleted: string }>(`/api/layers/${id}?force=${force}`, {
      method: 'DELETE',
    }),

  listFiles: (layerId: string) =>
    request<{ files: string[] }>(`/api/layers/${layerId}/files`),
  getFile: (layerId: string, filename: string) =>
    request<{ content: string }>(`/api/layers/${layerId}/files/${filename}`),
  saveFile: (layerId: string, filename: string, content: string) =>
    request<{ saved: string }>(`/api/layers/${layerId}/files/${filename}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),
  createFile: (
    layerId: string,
    filename: string,
    options?: { content?: string; overwrite?: boolean },
  ) =>
    request<{ filename: string; created: boolean }>(`/api/layers/${layerId}/files`, {
      method: 'POST',
      body: JSON.stringify({
        filename,
        content: options?.content ?? '',
        overwrite: options?.overwrite ?? false,
      }),
    }),
  deleteFile: (layerId: string, filename: string) =>
    request<{ deleted: string }>(`/api/layers/${layerId}/files/${filename}`, {
      method: 'DELETE',
    }),

  listExports: () => request<{ exports: ExportItem[] }>('/api/exports'),
  buildExport: (exportId: string) =>
    request<{ prompt: string }>(`/api/exports/${exportId}/build`),
  getGitBaseline: (exportId: string) =>
    request<{
      available: boolean;
      prompt: string | null;
      source: string | null;
      message: string | null;
    }>(`/api/exports/${exportId}/git-baseline`),
  exportToWorkspace: (exportId: string) =>
    request<{ path: string; prompt: string }>(`/api/exports/${exportId}/export`, {
      method: 'POST',
    }),

  getLLMConfig: () =>
    request<{ configured: boolean; config: LLMConfig | null }>('/api/llm/config'),
  saveLLMConfig: (config: LLMConfig) =>
    request<{ configured: boolean; config: LLMConfig }>('/api/llm/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),
  checkLLMHealth: (serverUrl?: string) => {
    const query = serverUrl ? `?server_url=${encodeURIComponent(serverUrl)}` : '';
    return request<LLMHealth>(`/api/llm/health${query}`);
  },
  testLLM: (prompt: string) =>
    request<LLMTestResult>('/api/llm/test', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),
};
