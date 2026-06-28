from fastapi import APIRouter, Response

from app.models import RegressionRunRequest, RegressionSuite
from app.services.regression.character_context import get_character_context
from app.services.regression.runner import get_run_report, list_runs, run_regression
from app.services.regression.snapshot import (
    create_snapshot,
    delete_snapshot,
    get_current_prefix,
    get_snapshot_status,
)
from app.services.regression.suite import (
    delete_suite,
    list_suites,
    load_suite,
    save_suite,
)

router = APIRouter(prefix="/api/regression", tags=["regression"])


@router.get("/snapshot/status")
def snapshot_status() -> dict:
    return get_snapshot_status()


@router.post("/snapshot")
async def snapshot_create() -> dict:
    return await create_snapshot()


@router.delete("/snapshot/{prompt_hash}")
def snapshot_delete(prompt_hash: str, response: Response) -> None:
    delete_snapshot(prompt_hash)
    response.status_code = 204


@router.get("/suites")
def suites_list() -> dict:
    return {"suites": list_suites()}


@router.get("/suites/{name}")
def suites_get(name: str) -> dict:
    suite = load_suite(name)
    return suite.model_dump()


@router.put("/suites/{name}")
def suites_save(name: str, body: RegressionSuite) -> dict:
    saved = save_suite(name, body)
    return saved.model_dump()


@router.delete("/suites/{name}")
def suites_delete(name: str, response: Response) -> None:
    delete_suite(name)
    response.status_code = 204


@router.get("/character-context")
def character_context() -> dict:
    prefix = get_current_prefix()
    return get_character_context(prefix)


@router.post("/run")
async def regression_run(body: RegressionRunRequest) -> dict:
    return await run_regression(body)


@router.get("/runs")
def runs_list(limit: int = 20) -> dict:
    return {"runs": list_runs(limit=limit)}


@router.get("/runs/{run_id}")
def runs_get(run_id: str) -> dict:
    return get_run_report(run_id)
