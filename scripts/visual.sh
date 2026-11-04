#!/bin/sh
# Runs the visual tests inside the same Playwright image as CI, so fonts and
# rendering match the committed baselines. Extra arguments go to Playwright,
# e.g. `pnpm test:visual --update-snapshots`.
#
# The repo is copied into the container (without node_modules), so the
# container's install never touches yours. Screenshots and test results are
# copied back afterwards.
set -eu
IMAGE="${PLAYWRIGHT_IMAGE:-mcr.microsoft.com/playwright:v1.63.0-noble}"

docker run --rm --ipc=host -v "$PWD":/src -e CI=1 -e PLAYWRIGHT_IMAGE="$IMAGE" "$IMAGE" bash -euc '
  mkdir -p /work
  tar -C /src --exclude=node_modules --exclude=.nx --exclude=dist -cf - . | tar -C /work -xf -
  cd /work
  corepack enable >/dev/null
  pnpm install --frozen-lockfile
  status=0
  pnpm nx run visual:visual --skip-nx-cache -- "$@" || status=$?
  for dir in __screenshots__ test-results playwright-report; do
    if [ -d "tests/visual/$dir" ]; then
      rm -rf "/src/tests/visual/$dir"
      cp -r "tests/visual/$dir" "/src/tests/visual/$dir"
    fi
  done
  exit "$status"
' visual "$@"
