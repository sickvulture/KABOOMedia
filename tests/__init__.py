# tests/__init__.py
"""
Test suite for Decentralized Social Media Platform
"""

import unittest
import sys
import os
from pathlib import Path

# Add the project root to Python path for testing
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

def run_all_tests():
    """Run all tests in the test suite"""
    loader = unittest.TestLoader()
    suite = loader.discover('.', pattern='test_*.py')
    runner = unittest.TextTestRunner(verbosity=2)
    return runner.run(suite)

if __name__ == '__main__':
    run_all_tests()
