"""Launch llama-server using config/llama.yaml."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "config" / "llama.yaml"


def _fail(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def find_binary(configured: str) -> str:
    if configured and configured != "auto":
        path = Path(configured)
        if path.is_file():
            return str(path.resolve())
        found = shutil.which(configured)
        if found:
            return found
        _fail(f"llama-server binary not found: {configured}")

    for name in ("llama-server", "llama-server.exe"):
        found = shutil.which(name)
        if found:
            return found

    _fail(
        "llama-server not found in PATH.\n"
        "Install from https://github.com/ggml-org/llama.cpp/releases\n"
        "or set binary: in config/llama.yaml"
    )


def resolve_model(path: str) -> Path:
    model_path = Path(path)
    if not model_path.is_absolute():
        model_path = ROOT / model_path
    if not model_path.is_file():
        _fail(
            f"Model file not found: {model_path}\n"
            "Place a .gguf file in models/ and update config/llama.yaml"
        )
    return model_path.resolve()


def load_config() -> dict:
    if not CONFIG_PATH.exists():
        _fail(
            f"Missing {CONFIG_PATH}\n"
            "Run: npm run setup\n"
            "Then edit config/llama.yaml and set model path."
        )
    with CONFIG_PATH.open(encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def normalize_extra_args(raw: object) -> list[str]:
    """Coerce extra_args to CLI strings (YAML may parse on/off as booleans)."""
    if raw is None:
        return []
    if not isinstance(raw, list):
        _fail("extra_args in config/llama.yaml must be a list")
    args: list[str] = []
    for item in raw:
        if isinstance(item, bool):
            args.append("true" if item else "false")
        elif isinstance(item, (int, float)):
            args.append(str(item))
        elif isinstance(item, str):
            args.append(item)
        else:
            _fail(f"Invalid extra_args entry: {item!r} (use quoted strings in YAML)")
    return args


def build_command(cfg: dict) -> list[str]:
    server = cfg.get("server", {})
    host = os.environ.get("LLAMA_HOST", server.get("host", "127.0.0.1"))
    port = os.environ.get("LLAMA_PORT", str(server.get("port", 8080)))

    model = os.environ.get("LLAMA_MODEL", cfg.get("model"))
    if not model:
        _fail("Set model: in config/llama.yaml (path to .gguf file)")

    binary = find_binary(os.environ.get("LLAMA_SERVER", cfg.get("binary", "auto")))
    model_path = resolve_model(model)

    cmd = [
        binary,
        "-m",
        str(model_path),
        "--host",
        str(host),
        "--port",
        str(port),
        "-c",
        str(cfg.get("ctx_size", 4096)),
        "-ngl",
        str(cfg.get("n_gpu_layers", -1)),
        "--parallel",
        str(cfg.get("parallel", 1)),
        *normalize_extra_args(cfg.get("extra_args")),
    ]
    return cmd, host, port, model_path


def main() -> None:
    cfg = load_config()
    cmd, host, port, model_path = build_command(cfg)

    print(f"==> llama-server  http://{host}:{port}")
    print(f"    model: {model_path}")
    print(f"    stop:  Ctrl+C")
    print()

    try:
        subprocess.run(cmd, check=False)
    except KeyboardInterrupt:
        print("\n==> llama-server stopped")


if __name__ == "__main__":
    main()
