"""
Base Value Object Implementation

AIDEV-NOTE: Proper DDD value object with immutability, validation, and equality.
All domain value objects should inherit from this base class.
"""

from abc import ABC
from typing import Any, TypeVar, Generic


T = TypeVar('T')


class ValueObject(ABC, Generic[T]):
    """
    Abstract base class for all value objects.
    
    Value objects are immutable objects that are defined by their values,
    not their identity. Two value objects are equal if their values are equal.
    """
    
    def __init__(self, value: T):
        """
        Initialize value object with validation.
        
        Args:
            value: The wrapped value
            
        Raises:
            ValueError: If value is invalid
        """
        self._validate(value)
        self._value = value
    
    def _validate(self, value: T) -> None:
        """
        Validate the value. Override in subclasses.
        
        Args:
            value: Value to validate
            
        Raises:
            ValueError: If value is invalid
        """
        if value is None:
            raise ValueError(f"{self.__class__.__name__} cannot be None")
    
    @property
    def value(self) -> T:
        """Get the wrapped value."""
        return self._value
    
    def __eq__(self, other: object) -> bool:
        """Value objects are equal if their values are equal."""
        return isinstance(other, self.__class__) and self._value == other._value
    
    def __hash__(self) -> int:
        """Value objects must be hashable."""
        return hash((self.__class__.__name__, self._value))
    
    def __str__(self) -> str:
        """String representation."""
        return f"{self.__class__.__name__}({self._value})"
    
    def __repr__(self) -> str:
        """Developer representation."""
        return f"{self.__class__.__name__}({self._value!r})"


class StringValueObject(ValueObject[str]):
    """Base class for string-based value objects."""
    
    def _validate(self, value: str) -> None:
        """Validate string value."""
        super()._validate(value)
        if not isinstance(value, str):
            raise ValueError(f"{self.__class__.__name__} must be a string")
        if not value.strip():
            raise ValueError(f"{self.__class__.__name__} cannot be empty")


class IntegerValueObject(ValueObject[int]):
    """Base class for integer-based value objects."""
    
    def _validate(self, value: int) -> None:
        """Validate integer value."""
        super()._validate(value)
        if not isinstance(value, int):
            raise ValueError(f"{self.__class__.__name__} must be an integer")


class PositiveIntegerValueObject(IntegerValueObject):
    """Base class for positive integer value objects."""
    
    def _validate(self, value: int) -> None:
        """Validate positive integer value."""
        super()._validate(value)
        if value <= 0:
            raise ValueError(f"{self.__class__.__name__} must be positive")