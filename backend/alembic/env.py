import sys
import os
from logging.config import fileConfig
from sqlmodel import SQLModel
from alembic import context

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import models
from config import settings

# Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target SQLModel metadata containing all 12 tables
target_metadata = SQLModel.metadata

def include_object(object, name, type_, reflected, compare_to):
    """Exclude SQLite internal tables, Turso shadow tables, FTS5 virtual tables, and vector artifacts."""
    if type_ == "table" and (
        name.startswith("campground_fts") or 
        name.endswith("_shadow") or
        name in ("sqlite_sequence", "sqlite_stat1", "tursocamp", "turso_test", "libsql_vector_meta_shadow")
    ):
        return False
    if type_ == "index" and name and (
        name.endswith("_vec") or 
        "vec" in name or 
        name.endswith("_shadow_idx")
    ):
        return False
    if type_ == "column" and name == "embedding":
        # Raw vector blob columns managed by vector extensions
        return False
    return True

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode generating raw SQL scripts."""
    url = config.get_main_option("sqlalchemy.url") or settings.DATABASE_URL
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode directly against database engine."""
    from database import engine

    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
            include_object=include_object,
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
