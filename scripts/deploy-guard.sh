#!/usr/bin/env bash
set -euo pipefail
if [[ "${GITHUB_REPOSITORY:-}" != "Westmorland/westmorland.me" || "${GITHUB_REF:-}" != "refs/heads/main" ]]; then
  printf '%s\n' 'Deployment denied: only the main branch of the website repository is permitted.' >&2
  exit 1
fi
case "${GITHUB_EVENT_NAME:-}" in
  push|workflow_dispatch) ;;
  *) printf '%s\n' 'Deployment denied: event is not a main push or manual run.' >&2; exit 1 ;;
esac
if [[ -z "${AZURE_STATIC_WEB_APPS_API_TOKEN:-}" ]]; then
  printf '%s\n' 'Deployment denied: app-specific deployment secret is missing.' >&2
  exit 1
fi
