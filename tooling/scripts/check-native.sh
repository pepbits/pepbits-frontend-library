#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
state=$(mktemp -d /tmp/pepbits-native-XXXXXX)
export NEXORA_RUN_DIR="$state/run" NEXORA_DATA_DIR="$state/data" RECORD_DATA_DIR="$state/data" API_PORT=3330
export XDG_CONFIG_HOME="$state/config" XDG_CACHE_HOME="$state/cache" XDG_DATA_HOME="$state/app-data" XDG_RUNTIME_DIR="$state/runtime"
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"
trap './run.sh stop api' EXIT
./run.sh start api
xvfb-run -a bash -c 'tauri-driver --native-driver /usr/bin/WebKitWebDriver > "$NEXORA_RUN_DIR/driver.log" 2>&1 & driver=$!; trap "kill $driver" EXIT; node demo-apps/desktop/scripts/native.mjs'
