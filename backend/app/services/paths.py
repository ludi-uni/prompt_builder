from pathlib import Path

from fastapi import HTTPException

from app.config import LAYERS_DIR


def resolve_layer_dir(layer_id: str) -> Path:
    if ".." in layer_id or "/" in layer_id or "\\" in layer_id:
        raise HTTPException(status_code=400, detail="Invalid layer id")
    layer_dir = (LAYERS_DIR / layer_id).resolve()
    if not str(layer_dir).startswith(str(LAYERS_DIR.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")
    return layer_dir


def resolve_layer_file(layer_id: str, filename: str) -> Path:
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    if not filename.endswith(".md"):
        raise HTTPException(status_code=400, detail="Only .md files are allowed")
    layer_dir = resolve_layer_dir(layer_id)
    file_path = (layer_dir / filename).resolve()
    if not str(file_path).startswith(str(layer_dir.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")
    return file_path


def normalize_filename(filename: str) -> str:
    name = filename.strip()
    if not name.endswith(".md"):
        name = f"{name}.md"
    if ".." in name or "/" in name or "\\" in name:
        raise HTTPException(status_code=400, detail="Invalid filename")
    return name
