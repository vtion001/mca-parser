"""Basic import verification tests for python-service."""
import pytest


def test_server_module_imports():
    """Verify server module can be imported."""
    from src import server
    assert server is not None


def test_config_module_imports():
    """Verify config module can be imported."""
    from src import config
    assert config is not None


def test_models_module_imports():
    """Verify models module can be imported."""
    from src import models
    assert models is not None
