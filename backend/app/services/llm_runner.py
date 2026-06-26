import time
from pathlib import Path

import httpx
import yaml
from fastapi import HTTPException

from app.config import CONFIG_DIR
from app.models import LLMConfig, LLMHealthResponse, LLMTestResponse, LLMUsageMetrics


class LLMNotConfiguredError(Exception):
    pass


def _config_path() -> Path:
    return CONFIG_DIR / "llm.yaml"


def load_llm_config() -> LLMConfig | None:
    path = _config_path()
    if not path.exists():
        return None
    with path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    if not data.get("server_url"):
        return None
    return LLMConfig.model_validate(data)


def save_llm_config(config: LLMConfig) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with _config_path().open("w", encoding="utf-8") as f:
        yaml.dump(
            config.model_dump(),
            f,
            allow_unicode=True,
            default_flow_style=False,
            sort_keys=False,
        )


def _int_or_none(value: object) -> int | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    return None


def _float_or_none(value: object) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    return None


def parse_llm_metrics(data: dict, elapsed_ms: float | None = None) -> LLMUsageMetrics:
    usage = data.get("usage") if isinstance(data.get("usage"), dict) else {}
    timings = data.get("timings") if isinstance(data.get("timings"), dict) else {}

    prompt_tokens = _int_or_none(usage.get("prompt_tokens"))
    completion_tokens = _int_or_none(usage.get("completion_tokens"))
    total_tokens = _int_or_none(usage.get("total_tokens"))

    ttft_ms = _float_or_none(timings.get("prompt_ms"))
    predicted_ms = _float_or_none(timings.get("predicted_ms"))

    tps = _float_or_none(timings.get("predicted_per_second"))
    if tps is None and completion_tokens and predicted_ms and predicted_ms > 0:
        tps = completion_tokens / (predicted_ms / 1000.0)

    total_ms = _float_or_none(timings.get("total_ms")) or elapsed_ms

    if total_tokens is None and (
        prompt_tokens is not None or completion_tokens is not None
    ):
        total_tokens = (prompt_tokens or 0) + (completion_tokens or 0)

    return LLMUsageMetrics(
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        tps=round(tps, 2) if tps is not None else None,
        ttft_ms=round(ttft_ms, 1) if ttft_ms is not None else None,
        total_ms=round(total_ms, 1) if total_ms is not None else None,
    )


class LlamaServerRunner:
    def __init__(self, config: LLMConfig):
        self.config = config

    async def run(self, prompt: str) -> LLMTestResponse:
        url = self.config.server_url.rstrip("/") + "/v1/chat/completions"
        payload = {
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
        }
        started = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=self.config.timeout_seconds) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
        except httpx.ConnectError as exc:
            raise HTTPException(
                status_code=503,
                detail=f"Cannot connect to llama-server at {self.config.server_url}",
            ) from exc
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"llama-server error: {exc.response.text}",
            ) from exc
        except httpx.TimeoutException as exc:
            raise HTTPException(
                status_code=504, detail="llama-server request timed out"
            ) from exc

        elapsed_ms = (time.perf_counter() - started) * 1000

        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise HTTPException(
                status_code=502, detail="Unexpected llama-server response"
            ) from exc

        usage = parse_llm_metrics(data, elapsed_ms=elapsed_ms)
        return LLMTestResponse(response=content, usage=usage)


async def check_llm_health(server_url: str | None = None) -> LLMHealthResponse:
    config = load_llm_config()
    if config is None and server_url is None:
        return LLMHealthResponse(
            configured=False,
            reachable=False,
            error="LLM is not configured",
        )

    url = (server_url or config.server_url).rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            for path in ("/health", "/v1/models"):
                try:
                    response = await client.get(url + path)
                    if response.status_code == 200:
                        return LLMHealthResponse(
                            configured=config is not None,
                            reachable=True,
                            server_url=url,
                        )
                except httpx.HTTPError:
                    continue
        return LLMHealthResponse(
            configured=config is not None,
            reachable=False,
            server_url=url,
            error="llama-server did not respond OK",
        )
    except httpx.ConnectError:
        return LLMHealthResponse(
            configured=config is not None,
            reachable=False,
            server_url=url,
            error=f"Cannot connect to {url}. Run: npm run llama",
        )
    except httpx.TimeoutException:
        return LLMHealthResponse(
            configured=config is not None,
            reachable=False,
            server_url=url,
            error="Connection timed out",
        )


async def run_llm_test(prompt: str) -> LLMTestResponse:
    config = load_llm_config()
    if config is None:
        raise HTTPException(status_code=503, detail="LLM is not configured")
    runner = LlamaServerRunner(config)
    return await runner.run(prompt)
