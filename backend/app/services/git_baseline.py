import subprocess

from app.config import ROOT, WORKSPACE_DIR

GIT_BASELINE_PATH = "workspace/generated_prompt.md"


def get_git_baseline() -> dict:
    if not (ROOT / ".git").is_dir():
        return {
            "available": False,
            "prompt": None,
            "source": None,
            "message": "Git repository not found",
        }

    result = subprocess.run(
        ["git", "show", f"HEAD:{GIT_BASELINE_PATH}"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=5,
        check=False,
    )
    if result.returncode == 0:
        return {
            "available": True,
            "prompt": result.stdout,
            "source": "git:HEAD",
            "message": None,
        }

    local_file = WORKSPACE_DIR / "generated_prompt.md"
    if local_file.is_file():
        return {
            "available": True,
            "prompt": local_file.read_text(encoding="utf-8"),
            "source": "workspace",
            "message": (
                "HEAD に未コミットのため、"
                "workspace/generated_prompt.md と比較しています"
            ),
        }

    return {
        "available": False,
        "prompt": None,
        "source": None,
        "message": (
            "workspace/generated_prompt.md が Git にも workspace にもありません。"
            "⋯ メニューから Export to workspace を実行してください"
        ),
    }
