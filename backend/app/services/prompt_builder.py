from app.models import BuildConfig
from app.services.build_loader import load_build_config


def build_from_config(config: BuildConfig) -> str:
    from fastapi import HTTPException

    from app.config import LAYERS_DIR, PROMPT_SEPARATOR

    parts: list[str] = []
    for step in config.build:
        for prompt_file in step.prompts:
            if ".." in step.layer or ".." in prompt_file:
                raise HTTPException(status_code=400, detail="Invalid path")
            file_path = LAYERS_DIR / step.layer / prompt_file
            if not file_path.exists():
                raise HTTPException(
                    status_code=404,
                    detail=f"Markdown not found: {step.layer}/{prompt_file}",
                )
            content = file_path.read_text(encoding="utf-8")
            parts.append(content.rstrip())
    return PROMPT_SEPARATOR.join(parts)


def build_prompt() -> str:
    config = load_build_config()
    return build_from_config(config)
