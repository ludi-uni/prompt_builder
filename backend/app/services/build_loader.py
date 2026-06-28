import yaml
from fastapi import HTTPException

from app.config import BUILD_PATH, LAYERS_DIR
from app.models import BuildConfig, BuildStep, LayersConfig


def _build_from_layers(layers: LayersConfig) -> BuildConfig:
    steps: list[BuildStep] = []
    for layer in layers.layers:
        layer_dir = LAYERS_DIR / layer.id
        if not layer_dir.is_dir():
            continue
        files = sorted(p.name for p in layer_dir.glob("*.md"))
        if files:
            steps.append(BuildStep(layer=layer.id, prompts=files))
    return BuildConfig(name="Prompt", build=steps)


def ensure_build_initialized() -> bool:
    """Create build.yaml from layers when missing. Returns True if created."""
    if BUILD_PATH.exists():
        return False

    from app.services.yaml_loader import load_layers_config

    layers = load_layers_config()
    save_build_config(_build_from_layers(layers))
    return True


def load_build_config() -> BuildConfig:
    ensure_build_initialized()
    if not BUILD_PATH.exists():
        raise HTTPException(status_code=404, detail="build.yaml not found")
    with BUILD_PATH.open(encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return BuildConfig.model_validate(data)


def save_build_config(config: BuildConfig) -> BuildConfig:
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
