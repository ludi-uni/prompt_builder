from pathlib import Path

import yaml

from app.config import LAYERS_DIR
from app.models import LayerMeta, LayersConfig

DEFAULT_LAYERS: list[LayerMeta] = [
    LayerMeta(id="system", name="System", description="System Prompt"),
    LayerMeta(id="persona", name="Persona", description="Character"),
    LayerMeta(id="memory", name="Memory", description="Long-term memory context"),
    LayerMeta(id="style", name="Style", description="Output style"),
]

DEFAULT_MARKDOWN: dict[str, dict[str, str]] = {
    "system": {
        "role.md": """# Role

You are a helpful AI assistant for live streaming.

Your primary role is to engage with viewers naturally while staying in character.
""",
        "safety.md": """# Safety

- Do not generate harmful, illegal, or explicit content.
- Decline inappropriate requests politely.
- Protect user privacy and personal information.
""",
    },
    "persona": {
        "identity.md": """# Identity

Name: Airi
Age: Appears early 20s
Occupation: Virtual streamer (AITuber)

Personality: Cheerful, curious, slightly mischievous.
""",
        "speech.md": """# Speech Style

- Use casual, friendly Japanese.
- Keep responses concise (1-3 sentences for chat).
- Occasionally use light humor and emoticons sparingly.
""",
    },
    "memory": {
        "memory.md": """# Memory

Remember key facts about regular viewers when mentioned.
Do not invent memories that were not provided in context.
""",
    },
    "style": {
        "concise.md": """# Concise Style

- Prefer short, direct answers.
- Avoid unnecessary preamble.
- Get to the point quickly.
""",
    },
}


def is_layers_empty() -> bool:
    if not LAYERS_DIR.exists():
        return True

    if any(LAYERS_DIR.rglob("*.md")):
        return False

    config_path = LAYERS_DIR / "layers.yaml"
    if not config_path.exists():
        return True

    try:
        with config_path.open(encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        layers = data.get("layers") or []
        return len(layers) == 0
    except (OSError, yaml.YAMLError):
        return True


def initialize_layers() -> None:
    from app.services.yaml_loader import save_layers_config

    LAYERS_DIR.mkdir(parents=True, exist_ok=True)
    save_layers_config(LayersConfig(layers=DEFAULT_LAYERS))

    for layer_id, files in DEFAULT_MARKDOWN.items():
        layer_dir = LAYERS_DIR / layer_id
        layer_dir.mkdir(parents=True, exist_ok=True)
        for filename, content in files.items():
            (layer_dir / filename).write_text(content, encoding="utf-8")


def ensure_layers_initialized() -> bool:
    """Initialize default layers when empty. Returns True if initialized."""
    if not is_layers_empty():
        return False
    initialize_layers()
    return True
