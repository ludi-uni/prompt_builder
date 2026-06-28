import yaml
from fastapi import HTTPException

from app.config import LAYERS_DIR
from app.models import LayersConfig
from app.services.bootstrap import ensure_layers_initialized


def load_layers_config() -> LayersConfig:
    ensure_layers_initialized()
    path = LAYERS_DIR / "layers.yaml"
    if not path.exists():
        raise HTTPException(status_code=404, detail="layers.yaml not found")
    with path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return LayersConfig.model_validate(data)


def save_layers_config(config: LayersConfig) -> None:
    path = LAYERS_DIR / "layers.yaml"
    LAYERS_DIR.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        yaml.dump(
            config.model_dump(exclude_none=True),
            f,
            allow_unicode=True,
            default_flow_style=False,
            sort_keys=False,
        )
