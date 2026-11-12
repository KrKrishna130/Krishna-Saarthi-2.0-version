#!/bin/bash
set -eu
cd "$(dirname "$0")"
if [ ! -f .env ]; then cp .env.example .env; fi
docker compose up --build -d --wait
cd desktop
if [ ! -d node_modules ]; then npm ci; fi
exec npm start
