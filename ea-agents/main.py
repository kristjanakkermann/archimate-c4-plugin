"""
EA Agents - Enterprise Architecture Agent Suite

A Python Agent SDK application that provides:
1. Ralph Loop Agent - Autonomous iteration for task completion
2. PRD Agent - Product Requirements Document generation

Usage:
    python main.py ralph "Your task description" --max-iterations 20
    python main.py prd "Feature description"
    python main.py interactive
"""
import asyncio
import argparse
import sys
from pathlib import Path

from ralph_loop import RalphLoopAgent, run_ralph_loop
from prd_agent import PRDAgent, generate_prd
from config import DEFAULT_MAX_ITERATIONS, DEFAULT_COMPLETION_PROMISE, EA_REPO_ROOT, check_api_key


def parse_args():
    parser = argparse.ArgumentParser(
        description="EA Agents - Enterprise Architecture Agent Suite",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run Ralph loop for autonomous task completion
  python main.py ralph "Build a REST API with tests" --max-iterations 20

  # Generate a PRD for a new feature
  python main.py prd "User authentication with OAuth2"

  # Interactive mode
  python main.py interactive
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Ralph loop command
    ralph_parser = subparsers.add_parser("ralph", help="Run Ralph loop agent")
    ralph_parser.add_argument("prompt", help="Task description for the agent")
    ralph_parser.add_argument(
        "--max-iterations", "-m",
        type=int,
        default=DEFAULT_MAX_ITERATIONS,
        help=f"Maximum iterations (default: {DEFAULT_MAX_ITERATIONS})"
    )
    ralph_parser.add_argument(
        "--completion-promise", "-c",
        default=DEFAULT_COMPLETION_PROMISE,
        help=f"Completion signal text (default: {DEFAULT_COMPLETION_PROMISE})"
    )
    ralph_parser.add_argument(
        "--cwd", "-d",
        help="Working directory for the agent"
    )

    # PRD command
    prd_parser = subparsers.add_parser("prd", help="Generate PRD document")
    prd_parser.add_argument("feature", help="Feature description")
    prd_parser.add_argument(
        "--cwd", "-d",
        help="Working directory (defaults to EA repo root)"
    )

    # Interactive command
    interactive_parser = subparsers.add_parser("interactive", help="Interactive mode")

    return parser.parse_args()


async def interactive_mode():
    """Run in interactive mode with menu selection."""
    print("\n" + "="*60)
    print("EA Agents - Interactive Mode")
    print("="*60)

    while True:
        print("\nSelect an option:")
        print("  1. Run Ralph Loop (autonomous task completion)")
        print("  2. Generate PRD (Product Requirements Document)")
        print("  3. Exit")

        choice = input("\nEnter choice (1-3): ").strip()

        if choice == "1":
            print("\n--- Ralph Loop Agent ---")
            prompt = input("Enter task description: ").strip()
            if not prompt:
                print("Task description required.")
                continue

            try:
                max_iter = int(input(f"Max iterations [{DEFAULT_MAX_ITERATIONS}]: ").strip() or DEFAULT_MAX_ITERATIONS)
            except ValueError:
                max_iter = DEFAULT_MAX_ITERATIONS

            completion = input(f"Completion promise [{DEFAULT_COMPLETION_PROMISE}]: ").strip() or DEFAULT_COMPLETION_PROMISE

            await run_ralph_loop(
                prompt=prompt,
                max_iterations=max_iter,
                completion_promise=completion
            )

        elif choice == "2":
            print("\n--- PRD Agent ---")
            feature = input("Enter feature description: ").strip()
            if not feature:
                print("Feature description required.")
                continue

            # Optional: collect discovery answers
            print("\nOptional: Answer discovery questions (press Enter to skip)")
            answers = {}

            problem = input("What problem are you solving? ").strip()
            if problem:
                answers["What problem are you trying to solve?"] = problem

            users = input("Who are the primary users? ").strip()
            if users:
                answers["Who are the primary users/stakeholders?"] = users

            await generate_prd(
                feature_description=feature,
                answers=answers if answers else None
            )

        elif choice == "3":
            print("\nGoodbye!")
            break

        else:
            print("Invalid choice. Please enter 1, 2, or 3.")


async def main():
    args = parse_args()

    # Validate API key before running any command
    if args.command in ("ralph", "prd", "interactive"):
        check_api_key()

    if args.command == "ralph":
        await run_ralph_loop(
            prompt=args.prompt,
            max_iterations=args.max_iterations,
            completion_promise=args.completion_promise,
            cwd=args.cwd
        )

    elif args.command == "prd":
        await generate_prd(
            feature_description=args.feature,
            cwd=args.cwd
        )

    elif args.command == "interactive":
        await interactive_mode()

    else:
        # No command specified, show help
        print("EA Agents - Enterprise Architecture Agent Suite")
        print("\nUsage: python main.py <command> [options]")
        print("\nCommands:")
        print("  ralph       - Run Ralph loop agent for autonomous task completion")
        print("  prd         - Generate Product Requirements Document")
        print("  interactive - Interactive menu mode")
        print("\nRun 'python main.py <command> --help' for more information.")


if __name__ == "__main__":
    asyncio.run(main())
