from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

from app.config import WORKSPACE_DIR
from app.models import BuildConfig
from app.services.build_loader import load_build_config, save_build_config
from app.services.git_baseline import get_git_baseline
from app.services.prompt_builder import build_prompt, build_prompt_with_meta

router = APIRouter(prefix="/api/build", tags=["build"])


@router.get("")
def get_build() -> dict:
    config = load_build_config()
    return config.model_dump()


@router.put("")
def update_build(body: BuildConfig) -> dict:
    saved = save_build_config(body)
    return saved.model_dump()


@router.get("/prompt")
def get_built_prompt() -> dict:
    return build_prompt_with_meta()


@router.get("/git-baseline")
def build_git_baseline() -> dict:
    load_build_config()
    return get_git_baseline()


@router.get("/prompt/text", response_class=PlainTextResponse)
def get_built_prompt_text() -> str:
    return build_prompt()


@router.post("/export")
def export_to_workspace() -> dict:
    prompt = build_prompt()
    WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)
    output_path = WORKSPACE_DIR / "generated_prompt.md"
    output_path.write_text(prompt, encoding="utf-8")
    return {"path": str(output_path), "prompt": prompt}
