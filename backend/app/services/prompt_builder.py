from fastapi import HTTPException

from app.config import LAYERS_DIR, PROMPT_SEPARATOR
from app.models import ExportConfig
from app.services.yaml_loader import load_export


def read_markdown(layer_id: str, filename: str) -> str:
    if ".." in layer_id or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid path")
    file_path = LAYERS_DIR / layer_id / filename
    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Markdown not found: {layer_id}/{filename}",
        )
    return file_path.read_text(encoding="utf-8")


def build_from_export(export: ExportConfig) -> str:
    parts: list[str] = []
    for step in export.build:
        for prompt_file in step.prompts:
            content = read_markdown(step.layer, prompt_file)
            parts.append(content.rstrip())
    return PROMPT_SEPARATOR.join(parts)


def build_prompt(export_name: str) -> str:
    export = load_export(export_name)
    return build_from_export(export)
