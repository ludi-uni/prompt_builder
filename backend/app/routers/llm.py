from fastapi import APIRouter

from app.models import LLMConfig, LLMTestRequest
from app.services.llm_runner import load_llm_config, run_llm_test, save_llm_config

router = APIRouter(prefix="/api/llm", tags=["llm"])


@router.get("/config")
def get_llm_config() -> dict:
    config = load_llm_config()
    if config is None:
        return {"configured": False, "config": None}
    return {"configured": True, "config": config}


@router.put("/config")
def update_llm_config(body: LLMConfig) -> dict:
    save_llm_config(body)
    return {"configured": True, "config": body}


@router.post("/test")
async def test_llm(body: LLMTestRequest) -> dict:
    result = await run_llm_test(body.prompt)
    return result.model_dump()
