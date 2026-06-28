import time

import httpx
from fastapi import HTTPException

from app.config import PROMPT_SEPARATOR
from app.models import LLMUsageMetrics
from app.services.llm_runner import (
    apply_chat_options,
    extract_assistant_content,
    load_llm_config,
    parse_llm_metrics,
)
from app.services.regression.paths import SLOT_ID


def build_case_prompt(prefix: str, user_input: str) -> str:
    return f"{prefix}{PROMPT_SEPARATOR}{user_input}"


class LlamaSlotClient:
    def __init__(self, server_url: str, timeout_seconds: float):
        self.base_url = server_url.rstrip("/")
        self.timeout = timeout_seconds
        self.llm_config = load_llm_config()

    def _chat_payload(self, payload: dict) -> dict:
        from app.models import LLMConfig

        config = self.llm_config or LLMConfig(server_url=self.base_url)
        return apply_chat_options(payload, config)

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

    async def prefill_prefix(
        self,
        prefix: str,
        slot_id: int = SLOT_ID,
    ) -> tuple[LLMUsageMetrics, float]:
        """
        Cache Prefix KV without generating assistant tokens.

        Uses the legacy /completion endpoint with n_predict=0 when available,
        falling back to chat completions with max_tokens=0.
        """
        started = time.perf_counter()
        try:
            data = await self._request(
                "POST",
                "/completion",
                json={
                    "prompt": prefix,
                    "id_slot": slot_id,
                    "cache_prompt": True,
                    "stream": False,
                    "n_predict": 0,
                    "temperature": 0.0,
                },
            )
        except HTTPException as exc:
            if exc.status_code != 502:
                raise
            data = await self._request(
                "POST",
                "/v1/chat/completions",
                json=self._chat_payload(
                    {
                        "messages": [{"role": "user", "content": prefix}],
                        "id_slot": slot_id,
                        "cache_prompt": True,
                        "stream": False,
                        "max_tokens": 0,
                        "temperature": 0.0,
                    }
                ),
            )

        elapsed_ms = (time.perf_counter() - started) * 1000
        usage = parse_llm_metrics(data, elapsed_ms=elapsed_ms)
        if usage.prompt_tokens is None:
            prompt_tokens = data.get("tokens_evaluated")
            if isinstance(prompt_tokens, int):
                usage = usage.model_copy(update={"prompt_tokens": prompt_tokens})
        return usage, elapsed_ms

    async def run_regression_case(
        self,
        *,
        prefix: str,
        user_input: str,
        slot_id: int = SLOT_ID,
        temperature: float = 0.7,
        max_tokens: int = 256,
    ) -> tuple[str, LLMUsageMetrics, float]:
        """
        Run one regression case using cached Prefix KV.

        Prefix and test input are sent as a single user message (same shape as
        RUN TEST) so chat templates for Gemma and similar models behave correctly.
        """
        payload = self._chat_payload(
            {
                "messages": [
                    {
                        "role": "user",
                        "content": build_case_prompt(prefix, user_input),
                    }
                ],
                "id_slot": slot_id,
                "cache_prompt": True,
                "stream": False,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
        )

        started = time.perf_counter()
        data = await self._request("POST", "/v1/chat/completions", json=payload)
        elapsed_ms = (time.perf_counter() - started) * 1000

        try:
            content = extract_assistant_content(data)
        except ValueError as exc:
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
