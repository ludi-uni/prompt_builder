export interface LayerMeta {
  id: string;
  name: string;
  display_name?: string | null;
  description?: string;
}

export interface BuildStep {
  layer: string;
  prompts: string[];
}

export interface BuildConfig {
  name: string;
  build: BuildStep[];
}

export interface LLMConfig {
  server_url: string;
  timeout_seconds: number;
  disable_reasoning?: boolean;
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

export interface RegressionSnapshotStatus {
  prefix_length: number;
  prefix_tokens_estimate: number | null;
  freshness: 'fresh' | 'stale' | 'missing';
  slot_save_path_configured: boolean;
  current: {
    prompt_hash: string;
    has_snapshot: boolean;
    snapshot_created_at: string | null;
    kv_file_exists: boolean;
    prefix_tokens: number | null;
  };
  latest_run: {
    run_id: string;
    passed: number;
    failed: number;
    finished_at: string;
  } | null;
}

export interface RegressionSuiteSummary {
  filename: string;
  name: string;
  description: string | null;
  case_count: number;
}

export interface RegressionCaseFailure {
  matcher: string;
  message: string;
  value?: string | number;
}

export interface RegressionCaseResult {
  id: string;
  status: 'pass' | 'fail' | 'error';
  input: string;
  output?: string;
  error?: string;
  failures?: RegressionCaseFailure[];
  usage?: LLMUsage | null;
}

export interface RegressionRunReport {
  run_id: string;
  suite: string;
  snapshot: {
    prompt_hash: string;
    stale: boolean;
  };
  character?: RegressionCharacterContext;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  cases: RegressionCaseResult[];
  started_at: string;
  finished_at: string;
}

export interface RegressionCharacterContext {
  names: string[];
  source: 'auto' | 'suite' | 'override' | 'missing';
  role_keywords: string[];
}

export interface RegressionRunRequest {
  suite: string;
  snapshot?: string;
  character_names?: string[];
  options?: {
    stop_on_first_failure?: boolean;
    ensure_snapshot?: boolean;
  };
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

  getBuild: () => request<BuildConfig>('/api/build'),
  updateBuild: (config: BuildConfig) =>
    request<BuildConfig>('/api/build', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),
  buildPrompt: () => request<{ prompt: string }>('/api/build/prompt'),
  getGitBaseline: () =>
    request<{
      available: boolean;
      prompt: string | null;
      source: string | null;
      message: string | null;
    }>('/api/build/git-baseline'),
  exportToWorkspace: () =>
    request<{ path: string; prompt: string }>('/api/build/export', {
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

  getRegressionSnapshotStatus: () =>
    request<RegressionSnapshotStatus>('/api/regression/snapshot/status'),
  createRegressionSnapshot: () =>
    request<{ prompt_hash: string; freshness: string }>('/api/regression/snapshot', {
      method: 'POST',
    }),
  listRegressionSuites: () =>
    request<{ suites: RegressionSuiteSummary[] }>('/api/regression/suites'),
  getRegressionCharacterContext: () =>
    request<RegressionCharacterContext>('/api/regression/character-context'),
  runRegression: (body: RegressionRunRequest) =>
    request<RegressionRunReport>('/api/regression/run', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
