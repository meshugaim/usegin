#!/bin/bash
# dx-gated: plan-align — disable with `dx disable plan-align`
if command -v dx >/dev/null 2>&1; then
  if [ "$(dx resolve plan-align 2>/dev/null)" = "false" ]; then
    exit 0
  fi
fi
exec plan align --compact
