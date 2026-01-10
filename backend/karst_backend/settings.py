"""
Backward compatibility shim for Django settings.

This file imports from the new settings/ package structure.
When Python imports "karst_backend.settings", it prefers this .py file over the settings/ directory.
We use importlib to load settings/__init__.py directly to avoid circular import issues.
"""
import importlib.util
import sys
from pathlib import Path

# Get the path to the settings package __init__.py
_settings_pkg_path = Path(__file__).parent / "settings" / "__init__.py"

# Load the settings package module directly
spec = importlib.util.spec_from_file_location("karst_backend.settings.package", _settings_pkg_path)
settings_pkg = importlib.util.module_from_spec(spec)
sys.modules["karst_backend.settings.package"] = settings_pkg  # Avoid re-import
spec.loader.exec_module(settings_pkg)

# Import all public settings from the package into this module's namespace
_this_module = sys.modules[__name__]
for key, value in settings_pkg.__dict__.items():
    if not key.startswith("_"):
        setattr(_this_module, key, value)
