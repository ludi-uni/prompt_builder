from pathlib import Path

from app.config import CONFIG_DIR, ROOT, WORKSPACE_DIR

REGRESSION_DIR = ROOT / "regression"
SUITES_DIR = REGRESSION_DIR / "suites"
FIXTURES_DIR = REGRESSION_DIR / "fixtures"

REGRESSION_WORKSPACE = WORKSPACE_DIR / "regression"
KV_DIR = REGRESSION_WORKSPACE / "kv"
SNAPSHOTS_DIR = REGRESSION_WORKSPACE / "snapshots"
RUNS_DIR = REGRESSION_WORKSPACE / "runs"

LLAMA_CONFIG_PATH = CONFIG_DIR / "llama.yaml"
SLOT_ID = 0


def ensure_regression_dirs() -> None:
    SUITES_DIR.mkdir(parents=True, exist_ok=True)
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
    KV_DIR.mkdir(parents=True, exist_ok=True)
    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    RUNS_DIR.mkdir(parents=True, exist_ok=True)


def hash_to_dirname(prompt_hash: str) -> str:
    if prompt_hash.startswith("sha256:"):
        return prompt_hash.removeprefix("sha256:")
    return prompt_hash


def kv_filename(prompt_hash: str) -> str:
    return f"{hash_to_dirname(prompt_hash)}.bin"


def snapshot_meta_path(prompt_hash: str) -> Path:
    return SNAPSHOTS_DIR / hash_to_dirname(prompt_hash) / "meta.yaml"


def snapshot_prefix_path(prompt_hash: str) -> Path:
    return SNAPSHOTS_DIR / hash_to_dirname(prompt_hash) / "prefix.txt"


def resolve_suite_path(name: str) -> Path:
    normalized = name if name.endswith(".yaml") else f"{name}.yaml"
    if ".." in normalized or "/" in normalized or "\\" in normalized:
        raise ValueError("Invalid suite name")
    path = (SUITES_DIR / normalized).resolve()
    if not str(path).startswith(str(SUITES_DIR.resolve())):
        raise ValueError("Invalid suite name")
    return path
