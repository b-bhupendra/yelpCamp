"""
build_fe_llm_archive.py
Generates an LLM-optimized single-file digest and clean source code zip archive
specifically for the YelpCamp Frontend (frontend-ver2), excluding node_modules,
build artifacts (dist), media assets, lockfiles, and secrets.
"""

import os
import shutil
import subprocess
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
FE_DIR = ROOT_DIR / "frontend-ver2"
CONTEXT_DIR = ROOT_DIR / "llm_context"

EXCLUDED_DIRS = {
    "node_modules",
    "dist",
    ".git",
    ".vscode",
    ".idea",
    ".agents",
    ".vercel",
    "llm_context",
    "docs",
    "archive",
}

EXCLUDED_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".pdf",
    ".zip",
    ".ttf",
    ".woff",
    ".woff2",
    ".log",
    ".map",
}

EXCLUDED_FILES = {
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lock",
    "frontend_llm_codebase.txt",
    "frontend_llm_codebase.md",
    "frontend_clean_codebase.zip",
    "build_fe_llm_archive.py",
}

LANG_MAP = {
    ".js": "javascript",
    ".jsx": "jsx",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".html": "html",
    ".css": "css",
    ".json": "json",
    ".md": "markdown",
    ".txt": "text",
}

def is_excluded(path: Path) -> bool:
    for part in path.parts:
        if part in EXCLUDED_DIRS:
            return True

    name = path.name
    if name.startswith(".env") or ".env." in name or name == ".env":
        return True

    if name in EXCLUDED_FILES:
        return True

    if path.suffix.lower() in EXCLUDED_EXTENSIONS:
        return True

    return False

def collect_fe_files():
    collected = []
    if not FE_DIR.exists():
        print(f"Error: {FE_DIR} does not exist!")
        return []

    for root, dirs, files in os.walk(FE_DIR):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        for f in sorted(files):
            file_path = Path(root) / f
            if not is_excluded(file_path):
                collected.append(file_path)
    return sorted(collected, key=lambda p: str(p.relative_to(ROOT_DIR)).replace("\\", "/"))

def get_git_info() -> str:
    try:
        commit = subprocess.check_output(
            ["git", "log", "-1", "--format=%h - %s (%ci)"],
            cwd=str(ROOT_DIR),
            text=True,
            stderr=subprocess.DEVNULL
        ).strip()
        branch = subprocess.check_output(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=str(ROOT_DIR),
            text=True,
            stderr=subprocess.DEVNULL
        ).strip()
        return f"Branch: {branch} | Commit: {commit}"
    except Exception:
        return "Git info unavailable"

def build_tree(files):
    lines = []
    for p in files:
        rel = str(p.relative_to(ROOT_DIR)).replace("\\", "/")
        lines.append(f"  - {rel}")
    return "\n".join(lines)

def main():
    print(f">> Scanning frontend directory: {FE_DIR.name} ...")
    files = collect_fe_files()
    print(f">> Total eligible frontend files found: {len(files)}")

    CONTEXT_DIR.mkdir(parents=True, exist_ok=True)
    output_txt = ROOT_DIR / "frontend_llm_codebase.txt"
    output_zip = ROOT_DIR / "frontend_clean_codebase.zip"
    context_txt = CONTEXT_DIR / "frontend_llm_codebase.txt"
    context_zip = CONTEXT_DIR / "frontend_clean_codebase.zip"

    git_info = get_git_info()
    utc_now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    local_now = datetime.now().strftime("%Y-%m-%d %H:%M:%S Local")

    total_lines = 0
    total_chars = 0

    # 1. Build single-file digest for LLMs
    with open(output_txt, "w", encoding="utf-8") as out:
        out.write("# YELPCAMP FRONTEND (frontend-ver2) CODEBASE ARCHIVE FOR LLM INGESTION\n")
        out.write(f"# Generated: {utc_now} ({local_now})\n")
        out.write(f"# Git: {git_info}\n")
        out.write(f"# Target Directory: frontend-ver2\n")
        out.write(f"# Total Files: {len(files)}\n")
        out.write("# Description: Complete React 19 + Vite + Tailwind CSS v4 + Agentic AI Co-Pilot frontend\n")
        out.write("# Note: node_modules, build outputs, lockfiles, and media assets are excluded.\n\n")

        out.write("=" * 80 + "\n")
        out.write("## FRONTEND DIRECTORY TREE\n")
        out.write("=" * 80 + "\n")
        out.write(build_tree(files))
        out.write("\n\n")

        out.write("=" * 80 + "\n")
        out.write("## FILE CONTENTS\n")
        out.write("=" * 80 + "\n\n")

        for p in files:
            rel = str(p.relative_to(ROOT_DIR)).replace("\\", "/")
            lang = LANG_MAP.get(p.suffix.lower(), "text")
            out.write("=" * 80 + "\n")
            out.write(f"FILE: {rel}\n")
            out.write(f"LANGUAGE: {lang}\n")
            out.write("=" * 80 + "\n")

            try:
                content = p.read_text(encoding="utf-8", errors="replace")
                lines = content.splitlines()
                total_lines += len(lines)
                total_chars += len(content)

                out.write(f"```{lang}\n")
                out.write(content)
                if not content.endswith("\n"):
                    out.write("\n")
                out.write("```\n\n")
            except Exception as e:
                out.write(f"[Error reading file: {e}]\n\n")

    shutil.copy2(output_txt, context_txt)

    print(f">> Generated Frontend LLM Digest: {output_txt.name} & {context_txt.relative_to(ROOT_DIR)}")
    print(f">> Total lines of code: {total_lines:,}")
    print(f">> Total characters: {total_chars:,} (~{total_chars // 4:,} estimated tokens)")
    print(f">> Digest file size: {output_txt.stat().st_size / (1024 * 1024):.2f} MB")

    # 2. Build clean frontend zip archive
    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in files:
            rel = str(p.relative_to(ROOT_DIR)).replace("\\", "/")
            zf.write(p, arcname=rel)

    shutil.copy2(output_zip, context_zip)

    print(f">> Created clean frontend source zip: {output_zip.name} & {context_zip.relative_to(ROOT_DIR)} ({output_zip.stat().st_size / 1024:.1f} KB)")
    print(">> Frontend LLM archive creation completed successfully.")

if __name__ == "__main__":
    main()
