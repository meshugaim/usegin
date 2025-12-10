# Retry Mechanism Configuration

This document explains how the retry mechanism works and how to configure it for different use cases.

## Overview

The Google File Search CLI includes a robust retry mechanism with exponential backoff to handle transient API errors, particularly overload situations from the Gemini API.

## Default Configuration

```python
DEFAULT_MAX_RETRIES = 5
DEFAULT_BASE_DELAY = 1.0  # seconds
DEFAULT_MAX_DELAY = 32.0  # seconds
DEFAULT_JITTER_RANGE = 0.1  # 10% jitter
```

## How It Works

### 1. Error Classification

When an API call fails, the system first determines if the error is retryable:

**Retryable Errors:**
- HTTP 429 (Rate Limit Exceeded)
- HTTP 500 (Internal Server Error)
- HTTP 503 (Service Unavailable)
- Errors containing keywords: "rate limit", "quota exceeded", "overload", "timeout", "connection"

**Non-Retryable Errors:**
- HTTP 400 (Bad Request)
- HTTP 401 (Unauthorized)
- HTTP 403 (Forbidden)
- HTTP 404 (Not Found)

### 2. Exponential Backoff

For retryable errors, the delay between attempts follows an exponential pattern:

```
Attempt 0: ~1.0 second
Attempt 1: ~2.0 seconds
Attempt 2: ~4.0 seconds
Attempt 3: ~8.0 seconds
Attempt 4: ~16.0 seconds
Attempt 5: ~32.0 seconds (max)
```

### 3. Jitter

To prevent multiple clients from retrying simultaneously (thundering herd problem), random jitter is added:

```python
jitter = delay * 0.1 * (2 * random.random() - 1)
# This adds ±10% randomness to the delay
```

### 4. Max Retries

After 5 failed attempts (by default), the function gives up and raises the last exception.

## Customizing Retry Behavior

### Option 1: Modify Global Defaults

Edit the constants at the top of `main.py`:

```python
# In main.py
DEFAULT_MAX_RETRIES = 10  # Increase max retries
DEFAULT_BASE_DELAY = 2.0  # Start with 2-second delays
DEFAULT_MAX_DELAY = 60.0  # Allow up to 60-second delays
DEFAULT_JITTER_RANGE = 0.2  # Use 20% jitter
```

### Option 2: Customize Individual Functions

Modify the decorator on specific API call functions:

```python
# More aggressive retry for critical operations
@retry_with_exponential_backoff(
    max_retries=10,
    base_delay=2.0,
    max_delay=60.0,
    jitter_range=0.2
)
def _critical_api_call(client, ...):
    # API call here
    pass

# Less aggressive retry for non-critical operations
@retry_with_exponential_backoff(
    max_retries=3,
    base_delay=1.0,
    max_delay=16.0,
    jitter_range=0.1
)
def _optional_api_call(client, ...):
    # API call here
    pass
```

### Option 3: Environment Variables (Future Enhancement)

Consider adding environment variable support for dynamic configuration:

```python
import os

DEFAULT_MAX_RETRIES = int(os.getenv('GEMINI_MAX_RETRIES', '5'))
DEFAULT_BASE_DELAY = float(os.getenv('GEMINI_BASE_DELAY', '1.0'))
DEFAULT_MAX_DELAY = float(os.getenv('GEMINI_MAX_DELAY', '32.0'))
DEFAULT_JITTER_RANGE = float(os.getenv('GEMINI_JITTER_RANGE', '0.1'))
```

Then use:
```bash
export GEMINI_MAX_RETRIES=10
export GEMINI_BASE_DELAY=2.0
uv run python main.py query <store-id> "query text"
```

## Monitoring and Logging

The retry mechanism logs detailed information at different levels:

### Warning Level (Retries)
```
2025-11-13 10:30:45 - WARNING - Retry 1/5 for query_store_api_call after error: 429 Rate limit exceeded. Waiting 1.05s...
```

### Error Level (Failures)
```
2025-11-13 10:30:55 - ERROR - Max retries (5) exceeded for query_store_api_call. Last error: 503 Service unavailable
```

### User-Facing Messages
```
Retrying due to API overload... (Attempt 1/5, waiting 1.0s)
```

## Performance Considerations

### Total Retry Time

With default settings (5 retries), maximum total wait time is:

```
1s + 2s + 4s + 8s + 16s = ~31 seconds
```

With jitter, expect roughly 28-34 seconds of total retry time.

### Reducing Wait Time

For faster failures in development:

```python
@retry_with_exponential_backoff(max_retries=2, base_delay=0.5, max_delay=4.0)
```

Total max wait time: ~0.5s + ~1s + ~2s = ~3.5 seconds

### Increasing Patience

For production environments with occasional heavy load:

```python
@retry_with_exponential_backoff(max_retries=8, base_delay=1.0, max_delay=120.0)
```

Total max wait time: ~1s + ~2s + ~4s + ~8s + ~16s + ~32s + ~64s + ~120s = ~247 seconds

## Best Practices

1. **Different Strategies for Different Operations:**
   - Query operations: More retries (user is waiting)
   - Batch uploads: Fewer retries (can retry entire batch)
   - Background operations: Most aggressive retries

2. **Monitor Retry Rates:**
   - Track how often retries occur
   - If >10% of requests need retries, consider rate limiting on your end

3. **Fail Fast for Development:**
   - Use fewer retries in development
   - Use more retries in production

4. **Log Analysis:**
   - Monitor logs for retry patterns
   - Identify specific operations that fail frequently

5. **Circuit Breaker Pattern (Future):**
   - Consider adding circuit breaker if API is consistently unavailable
   - Stop retrying if error rate exceeds threshold

## Troubleshooting

### Problem: Too Many Retries
**Symptom:** Operations take too long
**Solution:** Reduce `max_retries` or `base_delay`

### Problem: Operations Still Failing
**Symptom:** Max retries exceeded frequently
**Solution:** Increase `max_retries` or `max_delay`

### Problem: Thundering Herd
**Symptom:** Multiple clients retry at same time
**Solution:** Increase `jitter_range` to 0.2 or 0.3

### Problem: Non-Retryable Errors Being Retried
**Symptom:** Seeing retries on 400/401/403 errors
**Solution:** Update `is_retryable_error()` function to correctly classify the error

## Testing

Run the test suite to verify retry behavior:

```bash
uv run python test_retry.py
```

This tests:
- Error classification
- Backoff calculation
- Successful retries
- Max retries exceeded
- Non-retryable error handling

## References

- [Exponential Backoff and Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [Google Cloud Retry Strategy](https://cloud.google.com/apis/design/errors#error_retries)
- [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits)
