import re

DEFAULT_ROLE_KEYWORDS = ["配信", "AITuber", "VTuber", "ストリーマ", "streamer"]

NAME_PATTERNS = [
    re.compile(r"^Name:\s*(.+)$", re.MULTILINE | re.IGNORECASE),
    re.compile(r"^名前[:：]\s*(.+)$", re.MULTILINE),
    re.compile(r"^Character:\s*(.+)$", re.MULTILINE | re.IGNORECASE),
    re.compile(r"^キャラクター[:：]\s*(.+)$", re.MULTILINE),
]


def extract_character_names(text: str) -> list[str]:
    names: list[str] = []
    for pattern in NAME_PATTERNS:
        for match in pattern.finditer(text):
            raw = match.group(1).strip()
            first_line = raw.splitlines()[0].strip()
            if not first_line:
                continue
            if first_line not in names:
                names.append(first_line)
    return names


def resolve_character_names(
    prefix: str,
    *,
    suite_names: list[str] | None = None,
    override_names: list[str] | None = None,
) -> tuple[list[str], str]:
    if override_names:
        cleaned = [name.strip() for name in override_names if name.strip()]
        if cleaned:
            return cleaned, "override"

    if suite_names:
        cleaned = [name.strip() for name in suite_names if name.strip()]
        if cleaned:
            return cleaned, "suite"

    auto = extract_character_names(prefix)
    if auto:
        return auto, "auto"
    return [], "missing"


def build_in_character_pattern(
    names: list[str],
    *,
    include_role_keywords: bool = True,
) -> str | None:
    parts: list[str] = []
    for name in names:
        parts.append(re.escape(name))
        if re.search(r"[A-Za-z]", name):
            parts.append(re.escape(name.lower()))

    if include_role_keywords:
        parts.extend(re.escape(keyword) for keyword in DEFAULT_ROLE_KEYWORDS)

    unique_parts = list(dict.fromkeys(part for part in parts if part))
    if not unique_parts:
        return None
    return f"({'|'.join(unique_parts)})"


def get_character_context(
    prefix: str,
    *,
    suite_names: list[str] | None = None,
    override_names: list[str] | None = None,
) -> dict:
    names, source = resolve_character_names(
        prefix,
        suite_names=suite_names,
        override_names=override_names,
    )
    return {
        "names": names,
        "source": source,
        "role_keywords": DEFAULT_ROLE_KEYWORDS,
    }
