from pathlib import Path

import httpx
import yaml
from fastapi import HTTPException

from app.config import CONFIG_DIR
from app.models import LLMConfig, LLMTestResponse


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


class LlamaServerRunner:
    def __init__(self, config: LLMConfig):
        self.config = config

    async def run(self, prompt: str) -> str:
        url = self.config.server_url.rstrip("/") + "/v1/chat/completions"
        payload = {
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
        }
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
            raise HTTPException(status_code=504, detail="llama-server request timed out") from exc

        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise HTTPException(status_code=502, detail="Unexpected llama-server response") from exc


async def run_llm_test(prompt: str) -> LLMTestResponse:
    config = load_llm_config()
    if config is None:
        raise HTTPException(status_code=503, detail="LLM is not configured")
    runner = LlamaServerRunner(config)
    response = await runner.run(prompt)
    return LLMTestResponse(response=response)
