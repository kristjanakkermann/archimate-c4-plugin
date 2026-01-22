# EA Agents - Enterprise Architecture Agent Suite

Python Agent SDK application for Enterprise Architecture workflows, combining:

1. **Ralph Loop Agent** - Autonomous iteration agent (inspired by the [Ralph Wiggum technique](https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum))
2. **PRD Agent** - Product Requirements Document generator

## Installation

```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template and add your API key
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

Get your API key from [console.anthropic.com](https://console.anthropic.com/).

## Usage

### Ralph Loop Agent

Autonomous agent that keeps iterating on a task until completion:

```bash
# Basic usage
python main.py ralph "Build a REST API with CRUD operations and tests"

# With options
python main.py ralph "Refactor the authentication module" \
    --max-iterations 20 \
    --completion-promise "DONE" \
    --cwd /path/to/project
```

The agent will:
- Execute the task iteratively
- Monitor for the completion promise in responses
- Continue until the promise is found or max iterations reached
- Track costs across iterations

### PRD Agent

Generate Product Requirements Documents:

```bash
# Basic usage
python main.py prd "User authentication with OAuth2"

# With custom working directory
python main.py prd "Architecture dashboard" --cwd /path/to/ea-repo
```

The agent will:
- Analyze existing codebase for integration points
- Search existing requirements and decisions
- Generate a structured PRD with YAML frontmatter
- Include traceability sections for EA workflow

### Interactive Mode

```bash
python main.py interactive
```

## Project Structure

```
ea-agents/
├── main.py          # CLI entry point
├── ralph_loop.py    # Ralph Loop autonomous agent
├── prd_agent.py     # PRD generation agent
├── config.py        # Configuration and constants
├── requirements.txt # Python dependencies
├── .env.example     # Environment template
└── README.md        # This file
```

## Integration with EA Repo

These agents are designed to work with the Enterprise Architecture repository structure:

- PRDs are generated in `docs/10-requirements/`
- They include YAML frontmatter for machine parsing
- Traceability links to RFCs, ADRs, and architecture views
- Follow the ArchiMate + C4 modeling conventions

## How Ralph Loop Works

The Ralph Loop implements a self-referential feedback loop:

1. A prompt is fed to Claude
2. Claude works on the task and attempts to complete
3. If the completion promise (`<promise>COMPLETE</promise>`) is not found:
   - The same prompt is re-fed with iteration context
   - Claude sees its previous work in the files
4. Loop repeats until completion or max iterations

This pattern excels at:
- Tasks with clear success criteria
- Iterative refinement (getting tests to pass)
- Greenfield development
- Tasks with automatic verification

## API Reference

### RalphLoopAgent

```python
from ralph_loop import RalphLoopAgent

agent = RalphLoopAgent(
    prompt="Your task description",
    max_iterations=50,
    completion_promise="COMPLETE",
    allowed_tools=["Read", "Write", "Edit", "Bash"],
    cwd="/path/to/project"
)

async for event in agent.run():
    print(event)
```

### PRDAgent

```python
from prd_agent import PRDAgent

agent = PRDAgent(cwd="/path/to/ea-repo")

async for event in agent.generate_prd(
    feature_description="Your feature",
    answers={"Question": "Answer"}
):
    print(event)
```

## Related Tools

- [Ralph Wiggum Plugin](https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum) - Official Claude Code plugin
- [PRD Taskmaster](https://github.com/anombyte93/prd-taskmaster) - Claude Code skill for PRD generation
