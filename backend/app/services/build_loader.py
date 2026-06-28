import yaml
from fastapi import HTTPException

from app.models import BuildConfig, LayersConfig
from app.services.layer_discovery import (
    build_config_from_disk,
    configs_equal,
    resolve_build_config,
)
from app.services.yaml_loader import load_layers_config


def _build_from_layers(layers: LayersConfig) -> BuildConfig:
    return build_config_from_disk(layers)


def ensure_build_initialized() -> bool:
    """Create build.yaml from layers when missing. Returns True if created."""
    from app.config import BUILD_PATH

    if BUILD_PATH.exists():
        return False

    layers = load_layers_config()
    save_build_config(_build_from_layers(layers))
    return True


def _load_raw_build_config() -> BuildConfig:
    from app.config import BUILD_PATH

    ensure_build_initialized()
    if not BUILD_PATH.exists():
        raise HTTPException(status_code=404, detail="build.yaml not found")
    with BUILD_PATH.open(encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return BuildConfig.model_validate(data)


def load_build_config(*, heal: bool = True) -> BuildConfig:
    raw = _load_raw_build_config()
    try:
        layers = load_layers_config()
    except HTTPException:
        layers = None
    resolved, _warnings = resolve_build_config(raw, layers)
    if heal and not configs_equal(raw, resolved):
        save_build_config(resolved)
    return resolved


def resolve_build_with_warnings() -> tuple[BuildConfig, list[str]]:
    raw = _load_raw_build_config()
    try:
        layers = load_layers_config()
    except HTTPException:
        layers = None
    return resolve_build_config(raw, layers)


def save_build_config(config: BuildConfig) -> BuildConfig:
    from app.config import BUILD_PATH

    BUILD_PATH.parent.mkdir(parents=True, exist_ok=True)
    with BUILD_PATH.open("w", encoding="utf-8") as f:
        yaml.dump(
            config.model_dump(exclude_none=True),
            f,
            allow_unicode=True,
            default_flow_style=False,
            sort_keys=False,
        )
    return config
