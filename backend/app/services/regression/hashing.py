import hashlib
import re


def compute_prompt_hash(prefix: str) -> str:
    digest = hashlib.sha256(prefix.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip())
