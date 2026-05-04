from dataclasses import dataclass
from typing import Any, Awaitable, Callable


ToolHandler = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]


@dataclass(frozen=True)
class FitnessToolSpec:
    name: str
    description: str
    parameters: dict[str, Any]
    handler: ToolHandler


class FitnessToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, FitnessToolSpec] = {}

    def register(self, spec: FitnessToolSpec) -> None:
        self._tools[spec.name] = spec

    def get(self, name: str) -> FitnessToolSpec | None:
        return self._tools.get(name)

    def names(self) -> list[str]:
        return sorted(self._tools.keys())

    def json_schema(self) -> dict[str, Any]:
        return {
            name: {"description": spec.description, "parameters": spec.parameters}
            for name, spec in self._tools.items()
        }


def build_fitness_tool_registry() -> FitnessToolRegistry:
    from app.agent.tools.domain_tools import CORE_FITNESS_TOOLS

    registry = FitnessToolRegistry()
    for spec in CORE_FITNESS_TOOLS:
        registry.register(spec)
    return registry
