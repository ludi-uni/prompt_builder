from fastapi import APIRouter, HTTPException, Query

from app.models import (
    FileCreate,
    LayerCreate,
    LayerMeta,
    LayerUpdate,
)
from app.services.paths import normalize_filename, resolve_layer_dir, resolve_layer_file
from app.services.yaml_loader import load_layers_config, save_layers_config

router = APIRouter(prefix="/api/layers", tags=["layers"])


@router.get("")
def list_layers() -> dict:
    config = load_layers_config()
    return {"layers": config.layers}


@router.post("", status_code=201)
def create_layer(body: LayerCreate) -> LayerMeta:
    config = load_layers_config()
    if any(layer.id == body.id for layer in config.layers):
        raise HTTPException(status_code=409, detail=f"Layer '{body.id}' already exists")

    layer_dir = resolve_layer_dir(body.id)
    layer_dir.mkdir(parents=True, exist_ok=True)

    layer = LayerMeta(
        id=body.id,
        name=body.name,
        display_name=body.display_name,
        description=body.description,
    )
    config.layers.append(layer)
    save_layers_config(config)
    return layer


@router.put("/{layer_id}")
def update_layer(layer_id: str, body: LayerUpdate) -> LayerMeta:
    config = load_layers_config()
    for i, layer in enumerate(config.layers):
        if layer.id == layer_id:
            updated = layer.model_copy(
                update={
                    k: v
                    for k, v in body.model_dump(exclude_unset=True).items()
                    if v is not None
                }
            )
            config.layers[i] = updated
            save_layers_config(config)
            return updated
    raise HTTPException(status_code=404, detail=f"Layer '{layer_id}' not found")


@router.delete("/{layer_id}")
def delete_layer(layer_id: str, force: bool = Query(default=False)) -> dict:
    config = load_layers_config()
    layer_dir = resolve_layer_dir(layer_id)
    if not layer_dir.exists():
        raise HTTPException(status_code=404, detail=f"Layer '{layer_id}' not found")

    md_files = list(layer_dir.glob("*.md"))
    if md_files and not force:
        raise HTTPException(
            status_code=409,
            detail="Layer contains files. Use force=true to delete.",
        )

    import shutil

    if layer_dir.exists():
        shutil.rmtree(layer_dir)

    config.layers = [layer for layer in config.layers if layer.id != layer_id]
    save_layers_config(config)
    return {"deleted": layer_id}


@router.get("/{layer_id}/files")
def list_layer_files(layer_id: str) -> dict:
    layer_dir = resolve_layer_dir(layer_id)
    if not layer_dir.exists():
        raise HTTPException(status_code=404, detail=f"Layer '{layer_id}' not found")
    files = sorted(p.name for p in layer_dir.glob("*.md"))
    return {"files": files}


@router.get("/{layer_id}/files/{filename}")
def get_layer_file(layer_id: str, filename: str) -> dict:
    file_path = resolve_layer_file(layer_id, filename)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File '{filename}' not found")
    return {"content": file_path.read_text(encoding="utf-8")}


@router.put("/{layer_id}/files/{filename}")
def save_layer_file(layer_id: str, filename: str, body: dict) -> dict:
    file_path = resolve_layer_file(layer_id, filename)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File '{filename}' not found")
    content = body.get("content", "")
    if not isinstance(content, str):
        raise HTTPException(status_code=400, detail="content must be a string")
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content, encoding="utf-8")
    return {"saved": filename}


@router.post("/{layer_id}/files", status_code=201)
def create_layer_file(layer_id: str, body: FileCreate) -> dict:
    filename = normalize_filename(body.filename)
    layer_dir = resolve_layer_dir(layer_id)
    layer_dir.mkdir(parents=True, exist_ok=True)
    file_path = resolve_layer_file(layer_id, filename)
    existed = file_path.exists()
    if existed and not body.overwrite:
        raise HTTPException(status_code=409, detail=f"File '{filename}' already exists")
    file_path.write_text(body.content, encoding="utf-8")
    return {"filename": filename, "created": not existed}


@router.delete("/{layer_id}/files/{filename}")
def delete_layer_file(layer_id: str, filename: str) -> dict:
    file_path = resolve_layer_file(layer_id, filename)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File '{filename}' not found")
    file_path.unlink()
    return {"deleted": filename}
