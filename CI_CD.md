# CI/CD

## Foundation Workflow

The repository now contains `.github/workflows/ci.yml`, which runs for pull requests, pushes to `master`, and manual dispatches with read-only repository permissions. It performs a frozen-lockfile installation with lifecycle scripts disabled, then runs formatting checks, linting, strict type checking, source-level unit tests, production builds, and a high-severity production dependency-advisory check.

The workflow is intentionally a **local and CI foundation**. It does not deploy an environment, publish artifacts, access cloud credentials, or process production configuration. Deployment remains blocked until the environment, infrastructure-as-code, secrets, observability, backup/recovery, access, and approval decisions have been explicitly reviewed.

## Planned Gates

As the relevant capabilities are introduced, the pipeline must add integration/API tests, accessibility checks, security scanning beyond dependency advisories, license checks, E2E coverage for protected critical journeys, and artifact generation. Protected branches require successful applicable gates. Deployment requires successful gates and appropriate approval.
