#!/bin/bash
set -eu
cd "$(dirname "$0")/desktop"
if [ ! -d node_modules ]; then npm ci; fi
exec npm start
