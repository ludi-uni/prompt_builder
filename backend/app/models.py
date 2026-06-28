from pydantic import BaseModel, Field


class LayerMeta(BaseModel):
    id: str
    name: str
    display_name: str | None = None
    description: str | None = None


class LayersConfig(BaseModel):
    layers: list[LayerMeta]


class BuildStep(BaseModel):
    layer: str
    prompts: list[str]


class BuildConfig(BaseModel):
    name: str
    build: list[BuildStep]


class LayerCreate(BaseModel):
    id: str = Field(min_length=1, pattern=r"^[a-z][a-z0-9_-]*$")
    name: str = Field(min_length=1)
    display_name: str | None = None
    description: str | None = None


class LayerUpdate(BaseModel):
    name: str | None = None
    display_name: str | None = None
    description: str | None = None


class FileCreate(BaseModel):
    filename: str = Field(min_length=1)
    content: str = ""
    overwrite: bool = False


class LLMConfig(BaseModel):
    server_url: str = "http://127.0.0.1:8080"
    timeout_seconds: float = 120.0


class LLMTestRequest(BaseModel):
    prompt: str


class LLMUsageMetrics(BaseModel):
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None
    tps: float | None = None
    ttft_ms: float | None = None
    total_ms: float | None = None


class LLMTestResponse(BaseModel):
    response: str
    usage: LLMUsageMetrics | None = None


class LLMHealthResponse(BaseModel):
    configured: bool
    reachable: bool
    server_url: str | None = None
    error: str | None = None
