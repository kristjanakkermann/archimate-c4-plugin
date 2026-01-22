"""
Ralph Loop Agent - Autonomous iteration agent inspired by the Ralph Wiggum technique.

This agent implements a self-referential feedback loop where:
- A prompt is fed to Claude
- Claude works on the task and attempts to complete
- If the completion promise is not found, the loop re-feeds the same prompt
- Claude sees its previous work in files and can build on it
- The loop repeats until completion is signaled or max iterations reached
"""
import asyncio
from typing import AsyncIterator
from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    AssistantMessage,
    ResultMessage,
    TextBlock,
    HookMatcher,
    HookContext,
)
from config import DEFAULT_MAX_ITERATIONS, DEFAULT_COMPLETION_PROMISE, EDIT_TOOLS


class RalphLoopAgent:
    """
    Autonomous loop agent that keeps iterating until task completion.

    The agent monitors for a completion promise in Claude's responses
    and continues feeding the prompt until the promise is found or
    max iterations are reached.
    """

    def __init__(
        self,
        prompt: str,
        max_iterations: int = DEFAULT_MAX_ITERATIONS,
        completion_promise: str = DEFAULT_COMPLETION_PROMISE,
        allowed_tools: list[str] | None = None,
        cwd: str | None = None,
        system_prompt: str | None = None,
    ):
        self.prompt = prompt
        self.max_iterations = max_iterations
        self.completion_promise = completion_promise
        self.allowed_tools = allowed_tools or EDIT_TOOLS
        self.cwd = cwd
        self.system_prompt = system_prompt or self._default_system_prompt()

        self.iteration = 0
        self.completed = False
        self.cancelled = False

    def _default_system_prompt(self) -> str:
        return f"""You are an autonomous development agent operating in a loop.

Your task will be re-fed to you until you signal completion.
To signal completion, output: <promise>{self.completion_promise}</promise>

Guidelines:
1. Build incrementally - each iteration can see the results of previous iterations
2. Check existing files before creating new ones
3. Run tests after making changes
4. If stuck, document what's blocking progress
5. Only output the completion promise when ALL requirements are met

After {self.max_iterations} iterations, if not complete:
- Document what's blocking progress
- List what was attempted
- Suggest alternative approaches"""

    async def _check_for_completion(self, text: str) -> bool:
        """Check if the completion promise appears in the text."""
        return f"<promise>{self.completion_promise}</promise>" in text

    async def run(self) -> AsyncIterator[dict]:
        """
        Run the autonomous loop.

        Yields status updates and results for each iteration.
        """
        options = ClaudeAgentOptions(
            system_prompt=self.system_prompt,
            allowed_tools=self.allowed_tools,
            permission_mode="acceptEdits",
            cwd=self.cwd,
        )

        async with ClaudeSDKClient(options=options) as client:
            while self.iteration < self.max_iterations and not self.completed and not self.cancelled:
                self.iteration += 1

                yield {
                    "type": "iteration_start",
                    "iteration": self.iteration,
                    "max_iterations": self.max_iterations,
                }

                # Send the prompt
                iteration_prompt = f"""[Iteration {self.iteration}/{self.max_iterations}]

{self.prompt}

Remember: Output <promise>{self.completion_promise}</promise> when complete."""

                await client.query(iteration_prompt)

                # Collect response and check for completion
                response_text = ""
                async for message in client.receive_response():
                    if isinstance(message, AssistantMessage):
                        for block in message.content:
                            if isinstance(block, TextBlock):
                                response_text += block.text
                                yield {
                                    "type": "text",
                                    "iteration": self.iteration,
                                    "text": block.text,
                                }

                    if isinstance(message, ResultMessage):
                        yield {
                            "type": "iteration_result",
                            "iteration": self.iteration,
                            "is_error": message.is_error,
                            "duration_ms": message.duration_ms,
                            "cost_usd": message.total_cost_usd,
                        }

                # Check for completion promise
                if await self._check_for_completion(response_text):
                    self.completed = True
                    yield {
                        "type": "completed",
                        "iteration": self.iteration,
                        "message": f"Task completed after {self.iteration} iterations",
                    }
                    break

            if not self.completed and not self.cancelled:
                yield {
                    "type": "max_iterations_reached",
                    "iteration": self.iteration,
                    "message": f"Max iterations ({self.max_iterations}) reached without completion",
                }

    def cancel(self):
        """Cancel the loop."""
        self.cancelled = True


async def run_ralph_loop(
    prompt: str,
    max_iterations: int = DEFAULT_MAX_ITERATIONS,
    completion_promise: str = DEFAULT_COMPLETION_PROMISE,
    allowed_tools: list[str] | None = None,
    cwd: str | None = None,
) -> None:
    """
    Convenience function to run a Ralph loop and print results.

    Example:
        await run_ralph_loop(
            prompt="Build a REST API for todos with CRUD operations and tests",
            max_iterations=20,
            completion_promise="COMPLETE"
        )
    """
    agent = RalphLoopAgent(
        prompt=prompt,
        max_iterations=max_iterations,
        completion_promise=completion_promise,
        allowed_tools=allowed_tools,
        cwd=cwd,
    )

    print(f"\n{'='*60}")
    print(f"Ralph Loop Agent Starting")
    print(f"Max iterations: {max_iterations}")
    print(f"Completion promise: {completion_promise}")
    print(f"{'='*60}\n")

    total_cost = 0.0

    async for event in agent.run():
        event_type = event.get("type")

        if event_type == "iteration_start":
            print(f"\n--- Iteration {event['iteration']}/{event['max_iterations']} ---")

        elif event_type == "text":
            print(event["text"], end="", flush=True)

        elif event_type == "iteration_result":
            if event.get("cost_usd"):
                total_cost += event["cost_usd"]
            print(f"\n[Iteration {event['iteration']} completed - ${event.get('cost_usd', 0):.4f}]")

        elif event_type == "completed":
            print(f"\n\n{'='*60}")
            print(f"SUCCESS: {event['message']}")
            print(f"Total cost: ${total_cost:.4f}")
            print(f"{'='*60}")

        elif event_type == "max_iterations_reached":
            print(f"\n\n{'='*60}")
            print(f"WARNING: {event['message']}")
            print(f"Total cost: ${total_cost:.4f}")
            print(f"{'='*60}")


if __name__ == "__main__":
    # Example usage
    asyncio.run(run_ralph_loop(
        prompt="""Create a simple Python calculator module with:
1. Basic operations (add, subtract, multiply, divide)
2. Unit tests using pytest
3. A README.md with usage examples

Output <promise>COMPLETE</promise> when all requirements are met.""",
        max_iterations=10,
    ))
