from app.models import BuildConfig, BuildStep, LayerMeta, LayersConfig


def discover_layer_markdown() -> dict[str, list[str]]:
    """Scan layers/ for markdown files. Returns layer_id -> sorted filenames."""
    from app.config import LAYERS_DIR

    if not LAYERS_DIR.is_dir():
        return {}

    discovered: dict[str, list[str]] = {}
    for layer_dir in sorted(LAYERS_DIR.iterdir()):
        if not layer_dir.is_dir():
            continue
        files = sorted(path.name for path in layer_dir.glob("*.md"))
        if files:
            discovered[layer_dir.name] = files
    return discovered


def layer_order_hints(
    config: BuildConfig | None,
    layers: LayersConfig | None,
) -> list[str]:
    order: list[str] = []
    seen: set[str] = set()

    if config:
        for step in config.build:
            if step.layer not in seen:
                order.append(step.layer)
                seen.add(step.layer)

    if layers:
        for layer in layers.layers:
            if layer.id not in seen:
                order.append(layer.id)
                seen.add(layer.id)

    for layer_id in sorted(discover_layer_markdown().keys()):
        if layer_id not in seen:
            order.append(layer_id)
            seen.add(layer_id)

    return order


def merge_layers_with_disk(layers: LayersConfig) -> LayersConfig:
    """Include layer directories that exist on disk but are not in layers.yaml."""
    disk = discover_layer_markdown()
    known = {layer.id for layer in layers.layers}
    merged = list(layers.layers)
    for layer_id in sorted(disk.keys()):
        if layer_id in known:
            continue
        merged.append(
            LayerMeta(
                id=layer_id,
                name=layer_id.replace("_", " ").replace("-", " ").title(),
                display_name=layer_id,
            )
        )
    return LayersConfig(layers=merged)


def build_config_from_disk(layers: LayersConfig | None = None) -> BuildConfig:
    disk = discover_layer_markdown()
    order = layer_order_hints(None, layers)
    steps: list[BuildStep] = []
    for layer_id in order:
        files = disk.get(layer_id)
        if files:
            steps.append(BuildStep(layer=layer_id, prompts=files))
    for layer_id, files in sorted(disk.items()):
        if layer_id not in order:
            steps.append(BuildStep(layer=layer_id, prompts=files))
    return BuildConfig(name="Prompt", build=steps)


def resolve_build_config(
    config: BuildConfig,
    layers: LayersConfig | None = None,
) -> tuple[BuildConfig, list[str]]:
    """
    Align build.yaml with files on disk:
    - drop missing markdown references
    - append new markdown files and layers
    - preserve explicit ordering where possible
    """
    warnings: list[str] = []
    disk = discover_layer_markdown()

    if not config.build:
        resolved = build_config_from_disk(layers)
        if resolved.build:
            warnings.append("build.yaml was empty; generated build from disk")
        return resolved, warnings

    resolved_steps: list[BuildStep] = []
    seen_layers: set[str] = set()

    for step in config.build:
        seen_layers.add(step.layer)
        available = disk.get(step.layer, [])
        if not available:
            for filename in step.prompts:
                warnings.append(f"skipped missing: {step.layer}/{filename}")
            continue

        ordered: list[str] = []
        for filename in step.prompts:
            if filename in available:
                if filename not in ordered:
                    ordered.append(filename)
            else:
                warnings.append(f"skipped missing: {step.layer}/{filename}")

        for filename in available:
            if filename not in ordered:
                ordered.append(filename)
                warnings.append(f"auto-included: {step.layer}/{filename}")

        resolved_steps.append(BuildStep(layer=step.layer, prompts=ordered))

    order = layer_order_hints(config, layers)
    for layer_id in order:
        if layer_id in seen_layers:
            continue
        files = disk.get(layer_id)
        if not files:
            continue
        resolved_steps.append(BuildStep(layer=layer_id, prompts=files))
        warnings.append(f"auto-included layer: {layer_id}")

    for layer_id, files in sorted(disk.items()):
        if layer_id in seen_layers or layer_id in order:
            continue
        resolved_steps.append(BuildStep(layer=layer_id, prompts=files))
        warnings.append(f"auto-included layer: {layer_id}")

    return BuildConfig(name=config.name, build=resolved_steps), warnings


def configs_equal(left: BuildConfig, right: BuildConfig) -> bool:
    return left.model_dump() == right.model_dump()
