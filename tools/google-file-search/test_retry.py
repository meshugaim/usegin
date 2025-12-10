#!/usr/bin/env python3
"""
Test script to demonstrate the retry mechanism.

This script simulates API errors to show how the retry logic works.
It's for testing and demonstration purposes only.
"""

import sys
import time
import logging
from retry import (
    retry_with_exponential_backoff,
    is_retryable_error,
    calculate_backoff_delay,
)

# Get logger for testing
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)


class MockAPIError(Exception):
    """Mock API error for testing."""
    pass


class MockRateLimitError(Exception):
    """Mock rate limit error (429)."""
    def __str__(self):
        return "429 Rate limit exceeded - too many requests"


class MockServerError(Exception):
    """Mock server error (500)."""
    def __str__(self):
        return "500 Internal server error"


class MockServiceUnavailable(Exception):
    """Mock service unavailable error (503)."""
    def __str__(self):
        return "503 Service unavailable"


class MockOverloadError(Exception):
    """Mock overload error."""
    def __str__(self):
        return "API overload - please try again later"


class MockBadRequest(Exception):
    """Mock bad request error (400)."""
    def __str__(self):
        return "400 Bad request - invalid parameters"


def test_is_retryable_error():
    """Test the error classification logic."""
    print("Testing error classification...")
    print("=" * 80)

    # Test retryable errors
    retryable_errors = [
        MockRateLimitError(),
        MockServerError(),
        MockServiceUnavailable(),
        MockOverloadError(),
    ]

    print("\nRetryable errors:")
    for error in retryable_errors:
        result = is_retryable_error(error)
        status = "✓" if result else "✗"
        print(f"  {status} {error}")

    # Test non-retryable errors
    non_retryable_errors = [
        MockBadRequest(),
    ]

    print("\nNon-retryable errors:")
    for error in non_retryable_errors:
        result = is_retryable_error(error)
        status = "✗" if result else "✓"
        print(f"  {status} {error}")

    print()


def test_backoff_calculation():
    """Test the exponential backoff calculation."""
    print("\nTesting exponential backoff calculation...")
    print("=" * 80)
    print("\nBackoff delays for successive attempts:")

    for attempt in range(6):
        delay = calculate_backoff_delay(attempt)
        print(f"  Attempt {attempt}: {delay:.2f}s")

    print()


def test_successful_retry():
    """Test a function that succeeds after retries."""
    print("\nTesting successful retry after failures...")
    print("=" * 80)

    attempt_count = [0]  # Using list to allow mutation in closure

    @retry_with_exponential_backoff(max_retries=3, base_delay=0.5)
    def flaky_function():
        """Simulates a function that fails twice then succeeds."""
        attempt_count[0] += 1
        print(f"  Attempt {attempt_count[0]}")

        if attempt_count[0] < 3:
            raise MockRateLimitError()

        return "Success!"

    try:
        result = flaky_function()
        print(f"\n✓ Function succeeded: {result}")
        print(f"  Total attempts: {attempt_count[0]}")
    except Exception as e:
        print(f"\n✗ Function failed: {e}")

    print()


def test_max_retries_exceeded():
    """Test behavior when max retries is exceeded."""
    print("\nTesting max retries exceeded...")
    print("=" * 80)

    @retry_with_exponential_backoff(max_retries=2, base_delay=0.5)
    def always_fails():
        """Simulates a function that always fails."""
        raise MockServiceUnavailable()

    try:
        always_fails()
        print("\n✗ Should have raised an exception")
    except MockServiceUnavailable:
        print("\n✓ Correctly raised exception after exhausting retries")

    print()


def test_non_retryable_error():
    """Test behavior with non-retryable errors."""
    print("\nTesting non-retryable error handling...")
    print("=" * 80)

    @retry_with_exponential_backoff(max_retries=3, base_delay=0.5)
    def bad_request():
        """Simulates a function that returns a client error."""
        raise MockBadRequest()

    try:
        bad_request()
        print("\n✗ Should have raised an exception")
    except MockBadRequest:
        print("\n✓ Correctly raised exception immediately (no retries)")

    print()


def main():
    """Run all tests."""
    print("Retry Mechanism Test Suite")
    print("=" * 80)
    print()

    test_is_retryable_error()
    test_backoff_calculation()
    test_successful_retry()
    test_max_retries_exceeded()
    test_non_retryable_error()

    print("=" * 80)
    print("All tests completed!")
    print()


if __name__ == "__main__":
    main()
