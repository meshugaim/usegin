---
title: Instant integration test re-runs with KEEP_TEST_SUPABASE
handle: keep-test-supabase
tags: [testing, supabase, performance]
context: When running integration tests repeatedly
---

Set `KEEP_TEST_SUPABASE=1` to skip tearing down and recreating the test
database between runs. Cuts iteration time dramatically when the schema
hasn't changed.

Works with both `nextjs-db` and `python-db` integration tests.
