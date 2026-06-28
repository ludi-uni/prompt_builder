import time

import httpx
from fastapi import HTTPException

from app.models import LLMUsageMetrics
from app.services.llm_runner import load_llm_config, parse_llm_metrics
from app.services.regression.paths import SLOT_ID


class LlamaSlotClient:
    def __init__(self, server_url: str, timeout_seconds: float):
        self.base_url = server_url.rstrip("/")
        self.timeout = timeout_seconds

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json: dict | None = None,
    ) -> dict:
        url = self.base_url + path
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.request(method, url, json=json)
                response.raise_for_status()
                if not response.content:
                    return {}
                data = response.json()
                return data if isinstance(data, dict) else {}
        except httpx.ConnectError as exc:
            raise HTTPException(
                status_code=503,
                detail=(
                    f"Cannot connect to llama-server at {self.base_url}. "
                    "Run: npm run llama"
                ),
            ) from exc
        except httpx.HTTPStatusError as exc:
            text = exc.response.text
            if exc.response.status_code == 404 and "slots" in path:
                raise HTTPException(
                    status_code=502,
                    detail=(
                        "slot API unavailable. "
                        "Add --slot-save-path to config/llama.yaml extra_args"
                    ),
                ) from exc
            raise HTTPException(
                status_code=502,
                detail=f"llama-server error: {text}",
            ) from exc
        except httpx.TimeoutException as exc:
            raise HTTPException(
                status_code=504,
                detail="llama-server request timed out",
            ) from exc

    async def erase_slot(self, slot_id: int = SLOT_ID) -> None:
        await self._request("POST", f"/slots/{slot_id}?action=erase")

    async def save_slot(self, filename: str, slot_id: int = SLOT_ID) -> dict:
        return await self._request(
            "POST",
            f"/slots/{slot_id}?action=save",
            json={"filename": filename},
        )

    async def restore_slot(self, filename: str, slot_id: int = SLOT_ID) -> dict:
        return await self._request(
            "POST",
            f"/slots/{slot_id}?action=restore",
            json={"filename": filename},
        )

    async def chat_completion(
        self,
        *,
        prefix: str,
        user_input: str | None = None,
        slot_id: int = SLOT_ID,
        temperature: float = 0.7,
        max_tokens: int = 256,
    ) -> tuple[str, LLMUsageMetrics, float]:
        messages: list[dict[str, str]] = [{"role": "system", "content": prefix}]
        if user_input is not None:
            messages.append({"role": "user", "content": user_input})

        payload = {
            "messages": messages,
            "id_slot": slot_id,
            "cache_prompt": True,
            "stream": False,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        started = time.perf_counter()
        data = await self._request("POST", "/v1/chat/completions", json=payload)
        elapsed_ms = (time.perf_counter() - started) * 1000

        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise HTTPException(
                status_code=502, detail="Unexpected llama-server response"
            ) from exc

        usage = parse_llm_metrics(data, elapsed_ms=elapsed_ms)
        return content, usage, elapsed_ms


def get_llama_client() -> LlamaSlotClient:
    config = load_llm_config()
    if config is None:
        raise HTTPException(status_code=503, detail="LLM is not configured")
    return LlamaSlotClient(config.server_url, config.timeout_seconds)
