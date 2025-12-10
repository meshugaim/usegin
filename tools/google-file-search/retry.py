"""
Retry mechanism with exponential backoff for handling transient API errors.

This module provides a decorator and utility functions for implementing
robust retry logic with exponential backoff and jitter.
"""

import time
import random
import logging
from functools import wraps
from typing import Callable, Any

# Configure logging
logger = logging.getLogger(__name__)

# Retry configuration defaults
DEFAULT_MAX_RETRIES = 5
DEFAULT_BASE_DELAY = 1.0  # seconds
DEFAULT_MAX_DELAY = 32.0  # seconds
DEFAULT_JITTER_RANGE = 0.1  # 10% jitter


def is_retryable_error(error: Exception) -> bool:
    """
    Determine if an error should trigger a retry.

    Retryable errors:
    - 429: Rate limit exceeded
    - 500: Internal server error
    - 503: Service unavailable
    - Timeout errors
    - Connection errors

    Non-retryable errors:
    - 400: Bad request
    - 401: Unauthorized
    - 403: Forbidden
    - 404: Not found
    """
    error_str = str(error).lower()
    error_type = type(error).__name__

    # Check for specific HTTP status codes in error message
    if any(code in error_str for code in ['429', '503', '500']):
        return True

    # Check for common retryable error patterns
    retryable_patterns = [
        'rate limit',
        'quota exceeded',
        'service unavailable',
        'internal server error',
        'temporarily unavailable',
        'overload',
        'timeout',
        'connection',
        'deadline exceeded',
    ]

    if any(pattern in error_str for pattern in retryable_patterns):
        return True

    # Check for non-retryable status codes
    non_retryable_patterns = ['400', '401', '403', '404']
    if any(code in error_str for code in non_retryable_patterns):
        return False

    # Default to retrying on unknown errors (conservative approach)
    logger.debug(f"Unknown error type '{error_type}': {error_str}")
    return True


def calculate_backoff_delay(
    attempt: int,
    base_delay: float = DEFAULT_BASE_DELAY,
    max_delay: float = DEFAULT_MAX_DELAY,
    jitter_range: float = DEFAULT_JITTER_RANGE
) -> float:
    """
    Calculate exponential backoff delay with jitter.

    Args:
        attempt: Current attempt number (0-indexed)
        base_delay: Base delay in seconds
        max_delay: Maximum delay in seconds
        jitter_range: Jitter as a fraction of the delay (e.g., 0.1 = 10%)

    Returns:
        Delay in seconds with jitter applied
    """
    # Calculate exponential backoff: base_delay * 2^attempt
    delay = min(base_delay * (2 ** attempt), max_delay)

    # Add jitter to prevent thundering herd
    jitter = delay * jitter_range * (2 * random.random() - 1)
    final_delay = delay + jitter

    return max(0, final_delay)  # Ensure non-negative


def retry_with_exponential_backoff(
    max_retries: int = DEFAULT_MAX_RETRIES,
    base_delay: float = DEFAULT_BASE_DELAY,
    max_delay: float = DEFAULT_MAX_DELAY,
    jitter_range: float = DEFAULT_JITTER_RANGE
):
    """
    Decorator to add exponential backoff retry logic to a function.

    Args:
        max_retries: Maximum number of retry attempts
        base_delay: Base delay in seconds for exponential backoff
        max_delay: Maximum delay in seconds
        jitter_range: Jitter as a fraction of the delay

    Example:
        @retry_with_exponential_backoff(max_retries=5)
        def my_api_call():
            # API call code here
            pass
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            import sys  # Import here to avoid issues if not in main context
            last_exception = None

            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e

                    # Check if we should retry
                    if not is_retryable_error(e):
                        logger.error(f"Non-retryable error in {func.__name__}: {e}")
                        raise

                    # Check if we've exhausted retries
                    if attempt >= max_retries:
                        logger.error(
                            f"Max retries ({max_retries}) exceeded for {func.__name__}. "
                            f"Last error: {e}"
                        )
                        raise

                    # Calculate delay and wait
                    delay = calculate_backoff_delay(
                        attempt, base_delay, max_delay, jitter_range
                    )

                    logger.warning(
                        f"Retry {attempt + 1}/{max_retries} for {func.__name__} "
                        f"after error: {e}. Waiting {delay:.2f}s..."
                    )
                    print(
                        f"Retrying due to API overload... "
                        f"(Attempt {attempt + 1}/{max_retries}, waiting {delay:.1f}s)",
                        file=sys.stderr
                    )

                    time.sleep(delay)

            # This should never be reached, but just in case
            if last_exception:
                raise last_exception

        return wrapper
    return decorator
