from app.models import BuildConfig
from app.services.build_loader import load_build_config
from app.services.layer_discovery import resolve_build_config


def build_from_config(config: BuildConfig) -> str:
    from app.config import LAYERS_DIR, PROMPT_SEPARATOR

    resolved, _warnings = resolve_build_config(config)
    parts: list[str] = []
    for step in resolved.build:
        for prompt_file in step.prompts:
            if ".." in step.layer or ".." in prompt_file:
                continue
            file_path = LAYERS_DIR / step.layer / prompt_file
            if not file_path.is_file():
                continue
            content = file_path.read_text(encoding="utf-8")
            parts.append(content.rstrip())
    return PROMPT_SEPARATOR.join(parts)


def build_prompt() -> str:
    config = load_build_config()
    return build_from_config(config)


def build_prompt_with_meta() -> dict:
    from fastapi import HTTPException

    from app.services.build_loader import (
        _load_raw_build_config,
        configs_equal,
        save_build_config,
    )
    from app.services.yaml_loader import load_layers_config

    raw = _load_raw_build_config()
    try:
        layers = load_layers_config()
    except HTTPException:
        layers = None
    resolved, warnings = resolve_build_config(raw, layers)
    if not configs_equal(raw, resolved):
        save_build_config(resolved)
    prompt = build_from_config(resolved)
    result = {"prompt": prompt}
    if warnings:
        result["warnings"] = warnings
    return result
