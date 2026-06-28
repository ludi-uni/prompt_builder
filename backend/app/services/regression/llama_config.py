from pathlib import Path

import yaml

from app.config import ROOT
from app.services.regression.paths import LLAMA_CONFIG_PATH


def load_llama_config() -> dict:
    if not LLAMA_CONFIG_PATH.exists():
        return {}
    with LLAMA_CONFIG_PATH.open(encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def resolve_model_path(cfg: dict) -> str | None:
    model = cfg.get("model")
    if not model:
        return None
    model_path = Path(model)
    if not model_path.is_absolute():
        model_path = ROOT / model_path
    return str(model_path.resolve())


def slot_save_path_configured(cfg: dict | None = None) -> bool:
    data = cfg if cfg is not None else load_llama_config()
    extra_args = data.get("extra_args") or []
    return "--slot-save-path" in extra_args


def get_ctx_size(cfg: dict | None = None) -> int:
    data = cfg if cfg is not None else load_llama_config()
    return int(data.get("ctx_size", 4096))


def get_llama_env_snapshot(cfg: dict | None = None) -> dict:
    data = cfg if cfg is not None else load_llama_config()
    return {
        "model_path": resolve_model_path(data),
        "ctx_size": get_ctx_size(data),
        "slot_save_path_configured": slot_save_path_configured(data),
    }
