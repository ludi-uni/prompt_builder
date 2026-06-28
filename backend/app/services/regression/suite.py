from pathlib import Path

import yaml
from fastapi import HTTPException
from pydantic import ValidationError

from app.models import RegressionSuite
from app.services.regression.paths import (
    SUITES_DIR,
    ensure_regression_dirs,
    resolve_suite_path,
)


def list_suites() -> list[dict]:
    ensure_regression_dirs()
    suites: list[dict] = []
    for path in sorted(SUITES_DIR.glob("*.yaml")):
        try:
            suite = load_suite(path.name)
        except HTTPException:
            continue
        suites.append(
            {
                "filename": path.name,
                "name": suite.name,
                "description": suite.description,
                "case_count": len(suite.cases),
            }
        )
    return suites


def load_suite(name: str) -> RegressionSuite:
    path = resolve_suite_path(name)
    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"Suite not found: {name}")
    with path.open(encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}
    try:
        return RegressionSuite.model_validate(data)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def save_suite(name: str, suite: RegressionSuite) -> RegressionSuite:
    ensure_regression_dirs()
    path = resolve_suite_path(name)
    payload = suite.model_dump(exclude_none=True)
    with path.open("w", encoding="utf-8") as handle:
        yaml.dump(
            payload,
            handle,
            allow_unicode=True,
            default_flow_style=False,
            sort_keys=False,
        )
    return suite


def delete_suite(name: str) -> None:
    path = resolve_suite_path(name)
    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"Suite not found: {name}")
    path.unlink()


def suite_directory(name: str) -> Path:
    return resolve_suite_path(name).parent
