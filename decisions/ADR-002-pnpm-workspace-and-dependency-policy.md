# ADR-002: pnpm Workspace and Dependency Policy

**Status:** Accepted for the foundation increment
**Date:** 2026-08-18
**Decision owners:** Developer Lead, Security & Trust Guardian
**Related plan:** `WB_IMPLEMENTATION_PLAN.md`, Phase 1

## Context

The approved topology contains a web application, API application, and shared internal packages. The repository currently has no manifest, lockfile, dependency policy, reproducible scripts, or CI dependency workflow. WB requires explicit evaluation of dependency security, licensing, maintenance, maturity, performance, bundle impact, and vendor risk. [1] [2]

## Decision

WB will use a **`pnpm` workspace** with a committed lockfile and an exact package-manager declaration. The foundation supports the repository’s current Node.js 22 runtime baseline and requires Corepack-enabled `pnpm` for contributor and CI consistency.

| Policy area | Decision |
|---|---|
| Package manager | `pnpm`, declared in the root manifest through the `packageManager` field. |
| Workspace layout | `apps/*` and `packages/*`; runtime dependencies belong to the narrowest consuming package. |
| Lockfile | Commit `pnpm-lock.yaml`; treat unexpected lockfile changes as review-required. |
| Runtime | Node.js 22.x for the foundation; exact supported range is declared in the root manifest and CI. |
| Dependency additions | Add only after a stated purpose and review of security, maintenance, license, performance, and operational implications. |
| Versioning | Use pinned ranges supported by the selected toolchain; update deliberately through dependency-review work rather than opportunistic upgrades. |
| Script interface | Root scripts orchestrate format checking, linting, type checking, unit tests, build, and security checks across the workspace. |
| Generated output | Never commit `node_modules`, coverage, build output, environment files with values, caches, or local editor artifacts. |

## Alternatives Considered

| Alternative | Decision | Rationale |
|---|---|---|
| `npm` workspaces | Rejected | Viable, but `pnpm` offers strict workspace behavior and efficient isolated dependency handling for the planned multi-package repository. |
| One manifest without workspaces | Rejected | Would weaken ownership and make shared configuration/contracts harder to evolve cleanly. |
| Multiple independently managed repositories | Rejected | Conflicts with the single-repository strategy and increases early delivery overhead. |

## Consequences

All dependencies remain visible through one root lockfile and shared scripts. A package may not import another package’s internal implementation through relative source traversal; shared code must be exported through its package boundary. The initial bootstrap uses mature, conventional dependencies only: Next.js/React for the web app, NestJS for the API app, TypeScript, ESLint, Prettier, and a unit-test tool. Additional services, ORMs, caches, queues, UI component libraries, database clients, and AI SDKs are deferred until their specific milestone and ADR.

## Security and Supply-Chain Considerations

CI must run a frozen lockfile installation, dependency vulnerability review, and license/security tooling selected in the bootstrap increment. Package scripts from untrusted dependencies must not be treated as permission to execute arbitrary repository actions. Dependencies that handle identity, cryptography, payments, AI tools, user content, or sensitive data require heightened security review before introduction.

## Reversibility and Review

The workspace layout can be simplified or expanded by an ADR if actual product needs require it. Changing the package manager, Node major version, workspace boundary, or lockfile policy requires review because it affects reproducibility and supply-chain risk.

## References

[1]: ../PROJECT_INSTRUCTIONS.md "WB Project Instructions"
[2]: ../TECHNOLOGY_STACK.md "Technology Stack"
[3]: ../ENGINEERING_RULES.md "Engineering Rules"
