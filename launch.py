#!/usr/bin/env python3
"""
Launch script for Decentralized Social Media Platform
"""

import os
import sys
from pathlib import Path

# Add current directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

if __name__ == "__main__":
    from main import main
    main()
