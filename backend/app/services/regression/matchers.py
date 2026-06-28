import re
from pathlib import Path

from app.services.regression.character_context import (
    build_in_character_pattern,
    DEFAULT_ROLE_KEYWORDS,
)


class MatcherFailure:
    def __init__(
        self,
        matcher: str,
        message: str,
        value: str | int | None = None,
    ):
        self.matcher = matcher
        self.message = message
        self.value = value

    def to_dict(self) -> dict:
        result = {"matcher": self.matcher, "message": self.message}
        if self.value is not None:
            result["value"] = self.value
        return result


def _regex_flags(flags: str | None) -> int:
    if not flags:
        return 0
    result = 0
    if "i" in flags.lower():
        result |= re.IGNORECASE
    if "m" in flags.lower():
        result |= re.MULTILINE
    return result


def evaluate_matcher(
    output: str,
    matcher: dict,
    *,
    character_names: list[str] | None = None,
) -> tuple[bool, MatcherFailure | None]:
    matcher_type = matcher.get("type")
    if not matcher_type:
        return False, MatcherFailure("unknown", "matcher type is required")

    if matcher_type == "contains":
        value = str(matcher.get("value", ""))
        if value in output:
            return True, None
        return False, MatcherFailure(
            "contains", f"output does not contain {value!r}", value
        )

    if matcher_type == "not_contains":
        value = str(matcher.get("value", ""))
        if value not in output:
            return True, None
        return False, MatcherFailure(
            "not_contains",
            f"output contains forbidden phrase {value!r}",
            value,
        )

    if matcher_type == "exact":
        value = str(matcher.get("value", ""))
        if output == value:
            return True, None
        return False, MatcherFailure("exact", "output does not match exactly", value)

    if matcher_type == "regex":
        pattern = str(matcher.get("pattern", ""))
        if re.search(pattern, output, _regex_flags(matcher.get("flags"))):
            return True, None
        return False, MatcherFailure(
            "regex", f"output does not match pattern {pattern!r}", pattern
        )

    if matcher_type == "min_length":
        minimum = int(matcher.get("value", 0))
        if len(output) >= minimum:
            return True, None
        return False, MatcherFailure(
            "min_length",
            f"output length {len(output)} is below minimum {minimum}",
            minimum,
        )

    if matcher_type == "max_length":
        maximum = int(matcher.get("value", 0))
        if len(output) <= maximum:
            return True, None
        return False, MatcherFailure(
            "max_length",
            f"output length {len(output)} exceeds maximum {maximum}",
            maximum,
        )

    if matcher_type == "in_character":
        names = character_names or []
        if not names:
            return False, MatcherFailure(
                "in_character",
                "character name is not configured; set Regression character names",
            )
        include_role = matcher.get("role_keywords", True)
        pattern = build_in_character_pattern(names, include_role_keywords=include_role)
        if pattern is None:
            return False, MatcherFailure(
                "in_character",
                "character name is not configured; set Regression character names",
            )
        if re.search(pattern, output, re.IGNORECASE):
            return True, None
        label = ", ".join(names) if names else "character"
        extra = f" or {', '.join(DEFAULT_ROLE_KEYWORDS)}" if include_role else ""
        return False, MatcherFailure(
            "in_character",
            f"output does not mention {label}{extra}",
            label,
        )

    if matcher_type == "expected_file":
        return False, MatcherFailure(
            "expected_file",
            "expected_file matcher must be evaluated with suite context",
        )

    return False, MatcherFailure(matcher_type, f"unknown matcher type: {matcher_type}")


def evaluate_expected_file(
    output: str,
    expected_path: Path,
    match_mode: str = "normalize_whitespace",
) -> tuple[bool, MatcherFailure | None]:
    if not expected_path.is_file():
        return False, MatcherFailure(
            "expected_file",
            f"expected file not found: {expected_path.name}",
            expected_path.name,
        )

    expected = expected_path.read_text(encoding="utf-8")
    if match_mode == "exact":
        ok = output == expected
    elif match_mode == "substring":
        ok = expected in output or output in expected
    else:
        ok = normalize_whitespace(output) == normalize_whitespace(expected)

    if ok:
        return True, None
    return False, MatcherFailure(
        "expected_file",
        f"output does not match expected file ({match_mode})",
        expected_path.name,
    )


def evaluate_case(
    output: str,
    matchers: list[dict],
    *,
    expected_file: str | None = None,
    match_mode: str | None = None,
    suite_dir: Path | None = None,
    character_names: list[str] | None = None,
) -> tuple[bool, list[dict]]:
    failures: list[dict] = []

    for matcher in matchers:
        ok, failure = evaluate_matcher(
            output,
            matcher,
            character_names=character_names,
        )
        if not ok and failure:
            failures.append(failure.to_dict())

    if expected_file and suite_dir is not None:
        expected_path = (suite_dir / expected_file).resolve()
        regression_root = suite_dir.parent.resolve()
        if not str(expected_path).startswith(str(regression_root)):
            failures.append(
                MatcherFailure(
                    "expected_file", "expected file path escapes regression dir"
                ).to_dict()
            )
        else:
            mode = match_mode or "normalize_whitespace"
            ok, failure = evaluate_expected_file(output, expected_path, mode)
            if not ok and failure:
                failures.append(failure.to_dict())

    return len(failures) == 0, failures
