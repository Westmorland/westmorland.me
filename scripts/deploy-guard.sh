#!/usr/bin/env bash
set -euo pipefail
deny() { printf '%s\n' "Deployment denied: $1" >&2; exit 1; }
if [[ "${GITHUB_REPOSITORY:-}" != "Westmorland/westmorland.me" || "${GITHUB_REF:-}" != "refs/heads/main" ]]; then
  deny 'only the main branch of the website repository is permitted.'
fi
case "${GITHUB_EVENT_NAME:-}" in
  push|workflow_dispatch) ;;
  *) deny 'event is not a main push or manual run.' ;;
esac
[[ -n "${DEPLOYMENT_TOKEN:-}" ]] || deny 'app-specific deployment secret is missing.'
[[ "${VALIDATION_RESULT:-}" == 'success' ]] || deny 'validation did not succeed.'
[[ "${CHECKED_SHA:-}" =~ ^[a-f0-9]{40}$ ]] || deny 'checked revision is missing or malformed.'
[[ "${GITHUB_SHA:-}" == "$CHECKED_SHA" && "$(git rev-parse HEAD)" == "$CHECKED_SHA" ]] || deny 'checkout does not match the checked event revision.'
[[ "${CHECKED_DIST_TREE:-}" =~ ^[a-f0-9]{40}$ ]] || deny 'checked payload identity is missing or malformed.'
[[ "$(git rev-parse HEAD:dist)" == "$CHECKED_DIST_TREE" ]] || deny 'payload does not match validation.'
payload_status=$(git status --porcelain --untracked-files=all --ignored -- dist) || deny 'cannot inspect payload.'
[[ -z "$payload_status" ]] || deny 'payload has unvalidated changes.'

# Runs after environment approval, inside the serial production job, directly
# before upload. Never trust an old checkout's origin/main or queue order.
# This is a public, credential-free read; failure must not authorise deployment.
if ! current=$(GIT_TERMINAL_PROMPT=0 timeout 30s git -c credential.helper= ls-remote --exit-code https://github.com/Westmorland/westmorland.me.git refs/heads/main); then
  deny 'cannot verify current main.'
fi
[[ "$current" == "$CHECKED_SHA"$'\trefs/heads/main' ]] || deny 'checked revision is stale or current main is ambiguous.'
