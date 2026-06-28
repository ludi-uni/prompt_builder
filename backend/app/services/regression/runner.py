import asyncio
import json
import secrets
from datetime import datetime, timezone

from fastapi import HTTPException

from app.models import RegressionRunRequest
from app.services.regression.character_context import get_character_context
from app.services.regression.hashing import compute_prompt_hash
from app.services.regression.llama_slots import get_llama_client
from app.services.regression.matchers import evaluate_case
from app.services.regression.paths import RUNS_DIR, ensure_regression_dirs, kv_filename
from app.services.regression.snapshot import (
    create_snapshot,
    get_current_prefix,
    is_snapshot_stale,
    load_snapshot_meta,
)
from app.services.regression.suite import load_suite, suite_directory

_run_lock = asyncio.Lock()


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _make_run_id() -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    suffix = secrets.token_hex(2)
    return f"{stamp}-{suffix}"


def list_runs(limit: int = 20) -> list[dict]:
    ensure_regression_dirs()
    if not RUNS_DIR.is_dir():
        return []

    reports: list[dict] = []
    run_dirs = sorted(
        [path for path in RUNS_DIR.iterdir() if path.is_dir()],
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    for run_dir in run_dirs[:limit]:
        report_path = run_dir / "report.json"
        if not report_path.is_file():
            continue
        with report_path.open(encoding="utf-8") as handle:
            report = json.load(handle)
        reports.append(
            {
                "run_id": report.get("run_id"),
                "suite": report.get("suite"),
                "finished_at": report.get("finished_at"),
                "summary": report.get("summary"),
            }
        )
    return reports


def get_run_report(run_id: str) -> dict:
    report_path = RUNS_DIR / run_id / "report.json"
    if not report_path.is_file():
        raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")
    with report_path.open(encoding="utf-8") as handle:
        return json.load(handle)


async def run_regression(body: RegressionRunRequest) -> dict:
    if _run_lock.locked():
        raise HTTPException(
            status_code=409,
            detail="Another regression run is in progress",
        )

    async with _run_lock:
        return await _run_regression_locked(body)


async def _run_regression_locked(body: RegressionRunRequest) -> dict:
    ensure_regression_dirs()
    suite = load_suite(body.suite)
    prefix = get_current_prefix()
    prompt_hash = compute_prompt_hash(prefix)
    meta = load_snapshot_meta(prompt_hash)
    stale = is_snapshot_stale(meta, prompt_hash)

    if body.options.ensure_snapshot and (meta is None or stale):
        await create_snapshot()
        meta = load_snapshot_meta(prompt_hash)
        stale = is_snapshot_stale(meta, prompt_hash)
    elif meta is None:
        raise HTTPException(
            status_code=409,
            detail="Snapshot missing. Update snapshot before running regression.",
        )

    kv = (meta or {}).get("kv") or {}
    filename = kv.get("filename") or kv_filename(prompt_hash)
    client = get_llama_client()

    run_id = _make_run_id()
    run_dir = RUNS_DIR / run_id
    cases_dir = run_dir / "cases"
    cases_dir.mkdir(parents=True, exist_ok=True)

    started_at = _utc_now_iso()
    case_results: list[dict] = []
    passed = 0
    failed = 0

    suite_dir = suite_directory(body.suite)
    defaults = suite.defaults
    character_ctx = get_character_context(
        prefix,
        suite_names=suite.character_names,
        override_names=body.character_names,
    )
    character_names = character_ctx["names"]

    for case in suite.cases:
        temperature = (
            case.temperature if case.temperature is not None else defaults.temperature
        )
        max_tokens = (
            case.max_tokens if case.max_tokens is not None else defaults.max_tokens
        )

        try:
            await client.restore_slot(filename)
            output, usage, _ = await client.run_regression_case(
                prefix=prefix,
                user_input=case.input,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            matchers = [
                matcher.model_dump(exclude_none=True) for matcher in case.matchers
            ]
            ok, failures = evaluate_case(
                output,
                matchers,
                expected_file=case.expected_file,
                match_mode=case.match_mode,
                suite_dir=suite_dir,
                character_names=character_names,
            )
            status = "pass" if ok else "fail"
            if ok:
                passed += 1
            else:
                failed += 1

            result: dict = {
                "id": case.id,
                "status": status,
                "input": case.input,
                "output": output,
                "matchers": matchers,
                "usage": usage.model_dump() if usage else None,
            }
            if failures:
                result["failures"] = failures

        except HTTPException as exc:
            failed += 1
            result = {
                "id": case.id,
                "status": "error",
                "input": case.input,
                "error": exc.detail if isinstance(exc.detail, str) else str(exc.detail),
            }

        case_results.append(result)
        case_path = cases_dir / f"{case.id}.json"
        case_path.write_text(
            json.dumps(result, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        stop_on_fail = body.options.stop_on_first_failure
        if stop_on_fail and result.get("status") in {"fail", "error"}:
            break

    finished_at = _utc_now_iso()
    report = {
        "version": 1,
        "run_id": run_id,
        "suite": body.suite if body.suite.endswith(".yaml") else f"{body.suite}.yaml",
        "snapshot": {
            "prompt_hash": prompt_hash,
            "stale": stale,
        },
        "character": character_ctx,
        "started_at": started_at,
        "finished_at": finished_at,
        "summary": {
            "total": len(case_results),
            "passed": passed,
            "failed": failed,
            "skipped": 0,
        },
        "cases": case_results,
    }

    with (run_dir / "report.json").open("w", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)

    return report
