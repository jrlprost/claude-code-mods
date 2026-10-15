#!/bin/bash
# Copies shared/jr into every plugin's hooks/jr: a mod can only import its own files.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
for plugin in "$ROOT"/plugins/*/; do
  rm -rf "$plugin/hooks/jr"
  mkdir -p "$plugin/hooks/jr"
  cp "$ROOT"/shared/jr/* "$plugin/hooks/jr/"
done
echo "shared/jr synced into $(ls -d "$ROOT"/plugins/*/ | wc -l | tr -d ' ') plugins"
