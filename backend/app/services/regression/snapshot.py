import json
from datetime import datetime, timezone

import yaml
from fastapi import HTTPException

from app.services.build_loader import load_build_config
from app.services.llm_runner import load_llm_config
from app.services.prompt_builder import build_prompt
from app.services.regression.hashing import compute_prompt_hash
from app.services.regression.llama_config import (
    get_ctx_size,
    load_llama_config,
    resolve_model_path,
    slot_save_path_configured,
)
from app.services.regression.llama_slots import get_llama_client
from app.services.regression.paths import (
    KV_DIR,
    RUNS_DIR,
    SNAPSHOTS_DIR,
    ensure_regression_dirs,
    hash_to_dirname,
    kv_filename,
    snapshot_meta_path,
    snapshot_prefix_path,
)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_current_prefix() -> str:
    return build_prompt()


def load_snapshot_meta(prompt_hash: str) -> dict | None:
    path = snapshot_meta_path(prompt_hash)
    if not path.is_file():
        return None
    with path.open(encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def _meta_matches_env(meta: dict) -> bool:
    llama_cfg = load_llama_config()
    llama_meta = meta.get("llama") or {}
    model_meta = meta.get("model") or {}

    current_model = resolve_model_path(llama_cfg)
    if model_meta.get("path") and current_model and model_meta["path"] != current_model:
        return False
    if llama_meta.get("ctx_size") and llama_meta["ctx_size"] != get_ctx_size(llama_cfg):
        return False

    llm_cfg = load_llm_config()
    if llm_cfg and llama_meta.get("server_url"):
        if llama_meta["server_url"].rstrip("/") != llm_cfg.server_url.rstrip("/"):
            return False
    return True


def is_snapshot_stale(meta: dict | None, current_hash: str) -> bool:
    if meta is None:
        return True
    if meta.get("prompt_hash") != current_hash:
        return True
    if not _meta_matches_env(meta):
        return True
    kv = meta.get("kv") or {}
    filename = kv.get("filename") or kv_filename(current_hash)
    if not (KV_DIR / filename).is_file():
        return True
    if not slot_save_path_configured():
        return True
    return False


def get_snapshot_freshness(current_hash: str) -> str:
    meta = load_snapshot_meta(current_hash)
    if meta is None:
        return "missing"
    if is_snapshot_stale(meta, current_hash):
        return "stale"
    return "fresh"


def get_latest_run_summary() -> dict | None:
    if not RUNS_DIR.is_dir():
        return None
    run_dirs = sorted(
        [path for path in RUNS_DIR.iterdir() if path.is_dir()],
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    for run_dir in run_dirs:
        report_path = run_dir / "report.json"
        if not report_path.is_file():
            continue
        with report_path.open(encoding="utf-8") as handle:
            report = json.load(handle)
        summary = report.get("summary") or {}
        return {
            "run_id": report.get("run_id"),
            "passed": summary.get("passed"),
            "failed": summary.get("failed"),
            "finished_at": report.get("finished_at"),
        }
    return None


def get_snapshot_status() -> dict:
    ensure_regression_dirs()
    try:
        prefix = get_current_prefix()
    except HTTPException as exc:
        return {
            "prefix_length": 0,
            "prefix_tokens_estimate": None,
            "freshness": "missing",
            "slot_save_path_configured": slot_save_path_configured(),
            "current": {
                "prompt_hash": None,
                "has_snapshot": False,
                "snapshot_created_at": None,
                "kv_file_exists": False,
                "prefix_tokens": None,
            },
            "latest_run": get_latest_run_summary(),
            "error": exc.detail if isinstance(exc.detail, str) else str(exc.detail),
        }

    prompt_hash = compute_prompt_hash(prefix)
    meta = load_snapshot_meta(prompt_hash)
    freshness = get_snapshot_freshness(prompt_hash)
    kv = meta.get("kv") if meta else {}
    filename = (kv or {}).get("filename") or kv_filename(prompt_hash)

    return {
        "prefix_length": len(prefix),
        "prefix_tokens_estimate": (meta or {}).get("kv", {}).get("prefix_tokens"),
        "freshness": freshness,
        "slot_save_path_configured": slot_save_path_configured(),
        "current": {
            "prompt_hash": prompt_hash,
            "has_snapshot": meta is not None,
            "snapshot_created_at": meta.get("created_at") if meta else None,
            "kv_file_exists": (KV_DIR / filename).is_file(),
            "prefix_tokens": (kv or {}).get("prefix_tokens"),
        },
        "latest_run": get_latest_run_summary(),
    }


async def create_snapshot() -> dict:
    ensure_regression_dirs()
    if not slot_save_path_configured():
        raise HTTPException(
            status_code=502,
            detail=(
                "Add --slot-save-path to config/llama.yaml extra_args "
                "and restart llama-server"
            ),
        )

    prefix = get_current_prefix()
    prompt_hash = compute_prompt_hash(prefix)
    build_cfg = load_build_config()
    llama_cfg = load_llama_config()
    llm_cfg = load_llm_config()
    if llm_cfg is None:
        raise HTTPException(status_code=503, detail="LLM is not configured")

    client = get_llama_client()
    filename = kv_filename(prompt_hash)

    await client.erase_slot()
    _, usage, elapsed_ms = await client.chat_completion(
        prefix=prefix,
        user_input=None,
        max_tokens=1,
        temperature=0.0,
    )
    await client.save_slot(filename)

    snapshot_dir = SNAPSHOTS_DIR / hash_to_dirname(prompt_hash)
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    snapshot_prefix_path(prompt_hash).write_text(prefix, encoding="utf-8")

    meta = {
        "version": 1,
        "prompt_hash": prompt_hash,
        "created_at": _utc_now_iso(),
        "build_name": build_cfg.name,
        "model": {
            "path": resolve_model_path(llama_cfg),
        },
        "llama": {
            "ctx_size": get_ctx_size(llama_cfg),
            "server_url": llm_cfg.server_url,
        },
        "kv": {
            "slot_id": 0,
            "filename": filename,
            "prefix_tokens": usage.prompt_tokens,
        },
        "metrics": {
            "snapshot_ttft_ms": usage.ttft_ms,
            "snapshot_total_ms": usage.total_ms or round(elapsed_ms, 1),
        },
    }

    with snapshot_meta_path(prompt_hash).open("w", encoding="utf-8") as handle:
        yaml.dump(
            meta,
            handle,
            allow_unicode=True,
            default_flow_style=False,
            sort_keys=False,
        )

    return {
        "prompt_hash": prompt_hash,
        "freshness": "fresh",
        "meta": meta,
    }


def delete_snapshot(prompt_hash: str) -> None:
    if prompt_hash.startswith("sha256:"):
        normalized = prompt_hash
    else:
        normalized = f"sha256:{prompt_hash}"

    meta = load_snapshot_meta(normalized)
    if meta:
        kv = meta.get("kv") or {}
        filename = kv.get("filename") or kv_filename(normalized)
        kv_path = KV_DIR / filename
        if kv_path.is_file():
            kv_path.unlink()

    snapshot_dir = SNAPSHOTS_DIR / hash_to_dirname(normalized)
    if snapshot_dir.is_dir():
        for child in snapshot_dir.iterdir():
            child.unlink()
        snapshot_dir.rmdir()
