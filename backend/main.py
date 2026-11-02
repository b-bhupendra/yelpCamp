"""
Meadows Production API Entrypoint.
Delegates to the modern modular package app.main.
"""
from app.main import app

__all__ = ["app"]
