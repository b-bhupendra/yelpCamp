"""
build_be_llm_archive.py
Generates an LLM-optimized single-file digest and clean source code zip archive
specifically for the YelpCamp Backend (backend/), excluding virtualenvs (venv),
database binaries (database.db), media uploads, cache, lockfiles, and secrets (.env).
"""

import os
import zipfile
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
BE_DIR = ROOT_DIR / "backend"

EXCLUDED_DIRS = {
    "venv",
    ".venv",
    "__pycache__",
    ".pytest_cache",
    ".git",
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
    "backend_llm_codebase.txt",
    "backend_llm_codebase.md",
    "backend_clean_codebase.zip",
    "build_be_llm_archive.py",
    "database.db",
}

LANG_MAP = {
    ".py": "python",
    ".json": "json",
    ".md": "markdown",
    ".txt": "text",
    ".sql": "sql",
    ".sh": "bash",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".dockerignore": "dockerignore",
    ".gitignore": "gitignore",
}

def is_excluded(path: Path) -> bool:
    for part in path.parts:
        if part in EXCLUDED_DIRS:
            return True

    name = path.name
    # Exclude all .env files (security protection)
    if name.startswith(".env") or ".env." in name or name == ".env":
        return True

    if name in EXCLUDED_FILES:
        return True

    if path.suffix.lower() in EXCLUDED_EXTENSIONS:
        return True

    return False

def collect_files():
    collected = []
    if not BE_DIR.exists():
        print(f"Error: Backend directory {BE_DIR} does not exist.")
        return []

    for root, dirs, files in os.walk(BE_DIR):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        for f in sorted(files):
            file_path = Path(root) / f
            if not is_excluded(file_path):
                collected.append(file_path)

    return sorted(collected, key=lambda p: str(p.relative_to(BE_DIR)).replace("\\", "/"))

def build_tree(files):
    lines = []
    for p in files:
        rel = str(p.relative_to(BE_DIR)).replace("\\", "/")
        lines.append(f"  - backend/{rel}")
    return "\n".join(lines)

def main():
    print(f">> Scanning backend directory: {BE_DIR.name} ...")
    files = collect_files()
    print(f">> Total eligible backend files found: {len(files)}")

    output_txt = ROOT_DIR / "backend_llm_codebase.txt"
    output_zip = ROOT_DIR / "backend_clean_codebase.zip"

    total_lines = 0
    total_chars = 0

    # 1. Build text digest for LLMs
    with open(output_txt, "w", encoding="utf-8") as out:
        out.write("# YELPCAMP BACKEND CODEBASE ARCHIVE FOR LLM INGESTION\n")
        out.write(f"# Source Directory: {BE_DIR}\n")
        out.write(f"# Total Backend Files: {len(files)}\n")
        out.write("# Tech Stack: FastAPI + SQLModel (SQLAlchemy) + Turso libSQL/SQLite + Gemini RAG & Vector Search + Cloudinary CDN\n")
        out.write("# Exclusions: Virtual environments, database.db, secrets (.env), uploads, test caches, and binaries.\n\n")

        out.write("=" * 80 + "\n")
        out.write("## BACKEND DIRECTORY TREE\n")
        out.write("=" * 80 + "\n")
        out.write(build_tree(files))
        out.write("\n\n")

        out.write("=" * 80 + "\n")
        out.write("## BACKEND SOURCE FILE CONTENTS\n")
        out.write("=" * 80 + "\n\n")

        for p in files:
            rel = str(p.relative_to(BE_DIR)).replace("\\", "/")
            suffix = p.suffix.lower()
            lang = LANG_MAP.get(suffix, "")
            if not lang and p.name.lower() == "dockerfile":
                lang = "dockerfile"

            out.write("=" * 80 + "\n")
            out.write(f"FILE: backend/{rel}\n")
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

    print(f">> Generated Backend LLM Digest: {output_txt.name}")
    print(f">> Total lines of code: {total_lines:,}")
    print(f">> Total characters: {total_chars:,} (~{total_chars // 4:,} estimated tokens)")
    print(f">> Digest file size: {output_txt.stat().st_size / (1024 * 1024):.2f} MB")

    # 2. Build clean zip archive (backend source only)
    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in files:
            rel = str(p.relative_to(BE_DIR)).replace("\\", "/")
            zf.write(p, arcname=f"backend/{rel}")

    print(f">> Created clean backend source zip: {output_zip.name} ({output_zip.stat().st_size / 1024:.1f} KB)")
    print(">> Backend LLM archive creation completed successfully.")

if __name__ == "__main__":
    main()
