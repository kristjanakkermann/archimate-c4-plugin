"""
Configuration for EA Agents.
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Validate API key
def check_api_key():
    """Check if ANTHROPIC_API_KEY is configured."""
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("ERROR: ANTHROPIC_API_KEY not found in environment.")
        print("Please copy .env.example to .env and add your API key.")
        print("Get your key from: https://console.anthropic.com/")
        sys.exit(1)

# Paths
PROJECT_ROOT = Path(__file__).parent
EA_REPO_ROOT = PROJECT_ROOT.parent  # The archimate-c4-plugin directory

# Agent settings
DEFAULT_MAX_ITERATIONS = 50
DEFAULT_COMPLETION_PROMISE = "COMPLETE"

# Tool permissions
READONLY_TOOLS = ["Read", "Glob", "Grep", "WebSearch", "WebFetch"]
EDIT_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep", "Bash"]
ALL_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep", "Bash", "WebSearch", "WebFetch", "Task"]
