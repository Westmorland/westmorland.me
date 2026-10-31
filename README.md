# westmorland.me

A four-page personal website: Home, CV, Privacy and Terms. Header navigation links Home and CV; legal pages remain in the footer, alongside the approved LinkedIn, GitHub and Medium profiles. React enhances pre-rendered static HTML; there is no backend, sign-in, analytics or external runtime resource request.

The CV experience section includes employer-level Waterstons responsibilities and title progression, both Oak roles, Creating Careers / vision2learn and Tata Steel training facilitation. Earlier entries omit dates; the current role and employer dates remain displayed. Career descriptions are static content in `src/content.js`.

## Build and checks

Use Node.js 22 or newer, npm, BusyBox with its `httpd` applet, and Chromium or Chrome. Dependencies are pinned in `package-lock.json`. Tests use Node's test runner and Chrome DevTools Protocol.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm test
npm run test:integration
CHROME=/path/to/chrome SECURITY_HEADERS=1 npm run test:e2e
npm run check:payload
```

The integration and browser checks start temporary loopback servers and stop them afterwards. `BUSYBOX` overrides the server executable. E2E creates a disposable headless browser profile with `--no-sandbox`; use it only for these local test pages, never untrusted browsing. Screenshots go to ignored `test-results/screenshots/` (`SCREENSHOT_DIR` overrides it). `PAYLOAD_DENY_FILE` optionally names an external JSON array of additional prohibited text; do not commit private scan inputs.

- Unit/configuration: route boundaries, legacy links, generated security hashes, static routing, parsed workflow restrictions and executable negative deployment-gate cases.
- Integration: real HTTP responses from BusyBox, exact packaged bytes, static page content, redirects, 404s, source exclusion and licences. An additional HTTP wrapper verifies delivery of the generated security headers.
- E2E: browser navigation/history, direct URLs and refresh, mouse/keyboard/skip-link focus, responsive layouts from 320 to 1440 pixels, no-JavaScript pages, bundled fonts, browser errors, external requests and browser storage. Real pointer movement/clicks and emulated touch input check all four Home Focus numbers, their idle/highlight/restored colours and native list semantics. The AI title keeps its distinct styling; tapping only exercises Chromium's existing sticky hover, not selection or button behaviour. `SECURITY_HEADERS=1` applies the generated headers to actual responses, so Chromium enforces the CSP. The wrapper is not an Azure routing emulator.
- Payload: built-file allowlist, font and licence integrity, private-text checks and dependency origins. This is bounded scanning, not a general security or accessibility certification.

## Routes and security

`/`, `/cv/`, `/privacy/` and `/terms/` have pre-rendered HTML. Azure's global [`trailingSlash: "always"`](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration#trailing-slash) redirects `/privacy` and `/privacy/index.html` to `/privacy/` with status 301, and likewise for CV and Terms. The directory URLs serve their static `index.html` files with status 200. Do not add separate slash/non-slash route rules: Azure normalises those paths and rejects the duplicate rules. Local configuration regressions guard this arrangement, not Azure runtime enforcement. Legacy `/#/home`, `/#/privacy` and `/#/terms` links work; unknown hash routes display Home. Unknown HTTP paths display Home with a 404 status, not a successful SPA fallback.

CSS, JavaScript and four WOFF2 font faces are bundled into each HTML file. Third-party licences are in `dist/licenses/`. The build emits `dist/staticwebapp.config.json` from the root configuration and adds CSP hashes of the exact escaped inline script and style bytes. Animation delays live in CSS rather than inline attributes. No `unsafe-inline` or `unsafe-eval` permission is needed. The CSP denies network connections, forms, embedding and base-URL overrides; font and image data URLs remain permitted.

Azure uses the generated output configuration, not the source template alone. Its built-in Microsoft Entra ID (`/.auth/login/aad`) and GitHub (`/.auth/login/github`) sign-in routes are explicitly blocked with 404 responses, following [Microsoft's provider-blocking guidance](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-authorization#block-an-authentication-provider). Real Azure routing/header behaviour must still be verified after authorised deployment; local tests do not establish cloud parity.

## Website deployment workflow

`.github/workflows/website.yml` builds and tests before uploading only `dist/` with the supported Azure Static Web Apps action. It does not build an API or use cloud-management credentials. Actions are pinned to full upstream commit SHAs. The Azure action itself references Microsoft's mutable `staticappsclient:stable` container, so the action pin does not make the upstream deploy binary immutable.

Pull requests targeting `main`, main pushes and manual runs receive the unique `Website validation` check. Validation uses only `contents: read`, no environment or deployment secrets, non-persisted checkout credentials and no automatic package-manager cache. It checks the event's exact commit (the merge revision for PRs), builds and tests it, then records the SHA and committed `dist/` tree identity. Generated output must match the committed payload, with no tracked, untracked or ignored additions. There is no `pull_request_target` trigger or PR-comment token.

The separate production job requires successful validation and accepts only `push` or manual `workflow_dispatch` on `main` in `Westmorland/westmorland.me`. It references the `production` environment. An authorised administrator must configure that environment for `main` only, require `Westmorland` approval for every deployment, allow owner self-review, disable administrator bypass and keep the site-only deployment token there, not at repository scope. Main must require PRs and the strict `Website validation` check from GitHub Actions, including administrators, and disallow force pushes/deletion. These server-side settings are administrative responsibilities, not controls this YAML creates. Agents must not approve deployment on the owner's behalf.

After approval, production checks out the exact validation output SHA, verifies it against the event and checkout, verifies the payload tree and clean `dist/`, and uploads those committed bytes without rebuilding. Secret references appear only in this job. Missing secrets or unsuccessful validation fail closed without printing the token. No PR, other branch, tag or fork can enter production through the job predicate.

Production jobs share one concurrency group without cancelling an active upload. Immediately before upload, the guard reads public main afresh with a bounded, credential-free `git ls-remote`; it rejects stale revisions, ambiguous responses and failed reads. Queue ordering and old `origin/main` refs are not trusted. Thus an older queued, approved or rerun revision cannot overwrite a newer deployed main revision. A main push after this final check does not atomically stop an upload already in progress; serialisation prevents the newer deployment overtaking it, and the newer revision still needs its own successful validation and approval. To roll back, review a new main commit containing the desired old payload rather than approving an obsolete run.

Tests exercise parsed restrictions, the predicate and the actual shell guard against disposable local Git repositories, including advancing main, failed validation, wrong identities and tampered payloads. They do not prove GitHub scheduling, branch protection, environment approval, secret authentication or Azure enforcement. Those require authorised hosted checks; no successful remote workflow or deployment is implied by local tests.

References:

- https://learn.microsoft.com/en-us/azure/static-web-apps/configuration
- https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration
- https://github.com/Azure/static-web-apps-deploy

## Offline container packaging

Generated `dist/` is tracked for offline builds. After source changes, rebuild and commit matching output. A clean rebuild must leave `git diff --exit-code -- dist` empty.

The Dockerfile pins BusyBox by digest, serves baked `/site` on port 8080 as UID/GID 1000 and labels the image with `SOURCE_REVISION`. The base image must already be cached for an offline build:

```sh
docker build --network=none --pull=false --build-arg SOURCE_REVISION="$SOURCE_REVISION" -t "$IMAGE" .
```

The image supports a read-only root filesystem, dropped capabilities and no-new-privileges. Its context allowlist contains only the Dockerfile, server configuration and built files. BusyBox does not interpret Azure's configuration or serve its security headers; the browser's header-wrapper check is separate from this container runtime.
