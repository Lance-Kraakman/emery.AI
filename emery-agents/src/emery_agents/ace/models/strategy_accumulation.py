"""
Strategy Accumulation

Records successful execution patterns and surfaces them to the planner.
Part of the ACE (Agentic Context Engineering) pattern.

Used in BOTH phases:
- Planning: get_relevant_strategies() surfaces proven patterns
- Execution: record_execution() captures successful patterns
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any, Set
from enum import Enum
import re


class StrategyOutcome(Enum):
    """Outcome of a strategy execution."""
    SUCCESS = "success"
    PARTIAL = "partial"  # Some steps failed but goal partially achieved
    FAILURE = "failure"


@dataclass(frozen=True)
class ExecutionPattern:
    """
    A recorded execution pattern from a task.

    Captures the structure of how a goal was achieved,
    abstracted from specific parameter values.
    """
    pattern_id: str
    goal_signature: str           # Normalized goal (keywords extracted)
    step_sequence: tuple[str, ...]    # Ordered list of step descriptions
    agent_sequence: tuple[str, ...]   # Ordered list of target agents used
    tool_sequence: tuple[str, ...]    # Ordered list of tools used
    success_factors: tuple[str, ...]  # What made this successful
    failure_patterns: tuple[str, ...]  # What to avoid (from prior failures)

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "pattern_id": self.pattern_id,
            "goal_signature": self.goal_signature,
            "step_sequence": list(self.step_sequence),
            "agent_sequence": list(self.agent_sequence),
            "tool_sequence": list(self.tool_sequence),
            "success_factors": list(self.success_factors),
            "failure_patterns": list(self.failure_patterns),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ExecutionPattern":
        """Create from dictionary."""
        return cls(
            pattern_id=data["pattern_id"],
            goal_signature=data["goal_signature"],
            step_sequence=tuple(data.get("step_sequence", [])),
            agent_sequence=tuple(data.get("agent_sequence", [])),
            tool_sequence=tuple(data.get("tool_sequence", [])),
            success_factors=tuple(data.get("success_factors", [])),
            failure_patterns=tuple(data.get("failure_patterns", [])),
        )


@dataclass
class StrategyRecord:
    """
    A recorded strategy with usage statistics.

    Tracks how often a pattern is used and its success rate.
    """
    pattern: ExecutionPattern
    success_count: int = 0
    failure_count: int = 0
    partial_count: int = 0
    last_used_at: Optional[datetime] = None
    goal_keywords: Set[str] = field(default_factory=set)
    created_at: datetime = field(default_factory=datetime.utcnow)

    @property
    def total_uses(self) -> int:
        """Total number of times this strategy was used."""
        return self.success_count + self.failure_count + self.partial_count

    @property
    def success_rate(self) -> float:
        """Success rate (0.0-1.0)."""
        if self.total_uses == 0:
            return 0.0
        return self.success_count / self.total_uses

    @property
    def confidence_score(self) -> float:
        """
        Confidence based on usage count and success rate.

        More uses = more confidence, weighted by success rate.
        Caps at 10 uses for usage factor.
        """
        usage_factor = min(1.0, self.total_uses / 10)
        return usage_factor * self.success_rate

    def record_outcome(self, outcome: StrategyOutcome) -> None:
        """Record the outcome of using this strategy."""
        if outcome == StrategyOutcome.SUCCESS:
            self.success_count += 1
        elif outcome == StrategyOutcome.FAILURE:
            self.failure_count += 1
        else:
            self.partial_count += 1
        self.last_used_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "pattern": self.pattern.to_dict(),
            "success_count": self.success_count,
            "failure_count": self.failure_count,
            "partial_count": self.partial_count,
            "total_uses": self.total_uses,
            "success_rate": self.success_rate,
            "confidence_score": self.confidence_score,
            "last_used_at": self.last_used_at.isoformat() if self.last_used_at else None,
            "goal_keywords": list(self.goal_keywords),
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class StrategyRegistry:
    """
    In-memory registry of proven strategies.

    Indexes strategies by goal keywords for quick lookup.
    """
    strategies: Dict[str, StrategyRecord] = field(default_factory=dict)
    keyword_index: Dict[str, Set[str]] = field(default_factory=dict)

    # Common stopwords to exclude from keyword extraction
    STOPWORDS: Set[str] = field(default_factory=lambda: {
        'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been',
        'to', 'for', 'of', 'and', 'or', 'in', 'on', 'at', 'by', 'with',
        'that', 'this', 'it', 'from', 'as', 'can', 'will', 'would',
        'should', 'could', 'may', 'might', 'must', 'do', 'does', 'did',
        'have', 'has', 'had', 'i', 'you', 'we', 'they', 'he', 'she',
        'my', 'your', 'our', 'their', 'me', 'us', 'them', 'please',
    })

    def register_pattern(
        self,
        pattern: ExecutionPattern,
        goal_keywords: Set[str],
    ) -> StrategyRecord:
        """
        Register a new pattern or update existing.

        Args:
            pattern: The execution pattern to register
            goal_keywords: Keywords extracted from the goal

        Returns:
            The StrategyRecord (new or existing)
        """
        if pattern.pattern_id in self.strategies:
            record = self.strategies[pattern.pattern_id]
            # Update keywords
            record.goal_keywords.update(goal_keywords)
        else:
            record = StrategyRecord(
                pattern=pattern,
                goal_keywords=goal_keywords,
            )
            self.strategies[pattern.pattern_id] = record

            # Index by keywords
            for keyword in goal_keywords:
                if keyword not in self.keyword_index:
                    self.keyword_index[keyword] = set()
                self.keyword_index[keyword].add(pattern.pattern_id)

        return record

    def record_outcome(
        self,
        pattern_id: str,
        outcome: StrategyOutcome,
    ) -> None:
        """Record the outcome of using a strategy."""
        if pattern_id in self.strategies:
            self.strategies[pattern_id].record_outcome(outcome)

    def extract_keywords(self, text: str) -> Set[str]:
        """
        Extract searchable keywords from text.

        - Lowercases text
        - Removes punctuation
        - Filters stopwords
        - Filters short words (<3 chars)
        """
        # Extract words
        words = re.findall(r'\b\w+\b', text.lower())

        # Filter stopwords and short words
        return {
            w for w in words
            if w not in self.STOPWORDS and len(w) > 2
        }

    def get_top_strategies(self, limit: int = 10) -> List[StrategyRecord]:
        """Get top strategies by confidence score."""
        sorted_records = sorted(
            self.strategies.values(),
            key=lambda r: r.confidence_score,
            reverse=True
        )
        return sorted_records[:limit]

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "total_strategies": len(self.strategies),
            "strategies": {k: v.to_dict() for k, v in self.strategies.items()},
            "keyword_count": len(self.keyword_index),
        }
