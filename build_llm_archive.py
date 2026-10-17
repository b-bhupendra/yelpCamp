"""
build_llm_archive.py
Generates an LLM-optimized single-file digest and clean source code zip archive
for the YelpCamp project, excluding all binaries, downloadables, virtualenvs,
node_modules, media assets, and secrets.
"""

import os
import zipfile
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent

EXCLUDED_DIRS = {
    "node_modules",
    "venv",
    ".venv",
    "__pycache__",
    ".git",
    ".pytest_cache",
    "dist",
    "archive",
    "uploads",
    ".vercel",
    ".idea",
    ".vscode",
    ".agents",
}

EXCLUDED_EXTENSIONS = {
    ".pyc",
    ".pyo",
    ".db",
    ".db-shm",
    ".db-wal",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".pdf",
    ".zip",
    ".ico",
    ".ttf",
    ".woff",
    ".woff2",
    ".log",
}

EXCLUDED_FILES = {
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "yelpcamp_analysis.zip",
    "yelpcamp_clean_codebase.zip",
    "yelpcamp_llm_codebase.txt",
    "yelpcamp_llm_codebase.md",
    "build_llm_archive.py",
}

LANG_MAP = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "jsx",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".html": "html",
    ".css": "css",
    ".json": "json",
    ".md": "markdown",
    ".txt": "text",
    ".sql": "sql",
    ".sh": "bash",
    ".bat": "batch",
    ".ps1": "powershell",
    ".yaml": "yaml",
    ".yml": "yaml",
}

def is_excluded(path: Path) -> bool:
    # Check directory parts
    for part in path.parts:
        if part in EXCLUDED_DIRS:
            return True
    
    # Check secrets / env files
    name = path.name
    if name.startswith(".env") or ".env." in name or name == ".env":
        return True

    # Check excluded files
    if name in EXCLUDED_FILES:
        return True

    # Check extension
    if path.suffix.lower() in EXCLUDED_EXTENSIONS:
        return True

    return False

def collect_files():
    collected = []
    for root, dirs, files in os.walk(ROOT_DIR):
        # Filter directories in-place to prevent traversing excluded dirs
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        for f in sorted(files):
            file_path = Path(root) / f
            if not is_excluded(file_path):
                collected.append(file_path)
    return sorted(collected, key=lambda p: str(p.relative_to(ROOT_DIR)).replace("\\", "/"))

def build_tree(files):
    lines = []
    for p in files:
        rel = str(p.relative_to(ROOT_DIR)).replace("\\", "/")
        lines.append(f"  - {rel}")
    return "\n".join(lines)

def main():
    print(">> Collecting files for LLM Codebase Archive...")
    files = collect_files()
    print(f">> Total eligible files found: {len(files)}")

    output_txt = ROOT_DIR / "yelpcamp_llm_codebase.txt"
    output_zip = ROOT_DIR / "yelpcamp_clean_codebase.zip"

    total_lines = 0
    total_chars = 0

    # 1. Build text digest for LLMs
    with open(output_txt, "w", encoding="utf-8") as out:
        out.write("# YELPCAMP FULL CODEBASE ARCHIVE FOR LLM INGESTION\n")
        out.write(f"# Generated: {Path.cwd()}\n")
        out.write(f"# Total Files: {len(files)}\n")
        out.write("# Description: Complete application source code (FastAPI + Turso SQLite Vector RAG + React/Vite/Tailwind UI)\n")
        out.write("# Note: Downloadables, binaries, media, lockfiles, virtualenvs, and secrets are strictly excluded.\n\n")

        out.write("=" * 80 + "\n")
        out.write("## REPOSITORY DIRECTORY TREE\n")
        out.write("=" * 80 + "\n")
        out.write(build_tree(files))
        out.write("\n\n")

        out.write("=" * 80 + "\n")
        out.write("## FILE CONTENTS\n")
        out.write("=" * 80 + "\n\n")

        for p in files:
            rel = str(p.relative_to(ROOT_DIR)).replace("\\", "/")
            lang = LANG_MAP.get(p.suffix.lower(), "")
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

    print(f">> Created LLM digest: {output_txt.name}")
    print(f">> Total lines of code: {total_lines:,}")
    print(f">> Total characters: {total_chars:,} (~{total_chars // 4:,} estimated tokens)")
    print(f">> Digest file size: {output_txt.stat().st_size / (1024 * 1024):.2f} MB")

    # 2. Build clean zip archive (source only, no downloadables)
    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in files:
            rel = str(p.relative_to(ROOT_DIR)).replace("\\", "/")
            zf.write(p, arcname=rel)

    print(f">> Created clean source zip: {output_zip.name} ({output_zip.stat().st_size / 1024:.1f} KB)")
    print(">> Archive creation completed successfully.")

if __name__ == "__main__":
    main()
