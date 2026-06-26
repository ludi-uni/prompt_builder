from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

from app.config import WORKSPACE_DIR
from app.services.prompt_builder import build_prompt
from app.services.yaml_loader import list_exports, load_export

router = APIRouter(prefix="/api/exports", tags=["exports"])


@router.get("")
def get_exports() -> dict:
    names = list_exports()
    exports = []
    for name in names:
        export = load_export(name)
        exports.append({"id": name, "name": export.name})
    return {"exports": exports}


@router.get("/{export_name}")
def get_export(export_name: str) -> dict:
    export = load_export(export_name)
    return export.model_dump()


@router.get("/{export_name}/build")
def build_export(export_name: str) -> dict:
    prompt = build_prompt(export_name)
    return {"prompt": prompt}


@router.get("/{export_name}/build/text", response_class=PlainTextResponse)
def build_export_text(export_name: str) -> str:
    return build_prompt(export_name)


@router.post("/{export_name}/export")
def export_to_workspace(export_name: str) -> dict:
    prompt = build_prompt(export_name)
    WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)
    output_path = WORKSPACE_DIR / "generated_prompt.md"
    output_path.write_text(prompt, encoding="utf-8")
    return {"path": str(output_path), "prompt": prompt}
