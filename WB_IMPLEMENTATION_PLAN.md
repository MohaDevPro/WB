# WB Implementation Plan

**Plan version:** 1.0
**Prepared after:** `WB_INITIAL_ASSESSMENT.md` at baseline `2229ef0`
**Current delivery stage:** Foundation planning, followed by a bounded repository-bootstrap increment
**Primary delivery model:** Modular monolith; Arabic-first bilingual experience; security, trust, accessibility, observability, and documentation by design.

## 1. Objective

This plan converts WB’s strategic documentation into an executable delivery sequence without prematurely implementing the full ecosystem. The initial objective is to establish a **reproducible, secure, testable, accessible, and localized repository foundation** that can support the first vertical product slice: professional identity and a bounded community workflow.

The plan deliberately prioritizes foundation, engineering quality, localization, identity, authorization, and Community MVP capabilities before marketplace, payments, advanced intelligence, or autonomous operation. It preserves WB’s modular-monolith direction and does not authorize a rewrite into microservices. [1] [2]

> **Scope boundary:** This plan does not authorize production deployment, payment processing, custodial funds, high-impact automated actions, broad data collection, or external AI-provider integration. Those areas require later, explicit decision records and policy controls.

## 2. Governing Constraints

| Constraint | Implementation consequence |
|---|---|
| Modular monolith first | Build clear modules and interfaces inside a small number of deployable applications; do not create independently deployed services without evidence. |
| Arabic and English are first-class | Treat locale, RTL/LTR direction, translations, date/number/currency formatting, and accessible language changes as foundation capabilities. |
| Security and privacy by design | Add authentication, authorization, validation, safe errors, secrets discipline, data minimization, auditability, and dependency checks before exposing sensitive workflows. |
| Trust before growth | Implement explainable trust, human escalation, and moderation safeguards before high-stakes discovery or commercial flows. |
| AI is governed infrastructure | Defer model-provider calls until authorization, data classification, policy enforcement, observability, evaluation, and approval boundaries exist. |
| Documentation is part of delivery | Update the relevant document and, for material decisions, an ADR in the same change set as implementation. |
| High-impact change control | Architecture, security, identity, trust, compliance, payment, and AI autonomy changes require explicit review and an ADR where material. [3] |

## 3. Decisions Required Before Build

The current repository does not contain an application, dependency graph, runtime, data layer, or deployment configuration. The following decisions must therefore be made and recorded before corresponding implementation begins. The plan proposes the evaluation process, not unreviewed irreversible defaults.

| ID | Decision | Options to evaluate | Decision owner/reviewer | Build dependency |
|---|---|---|---|---|
| D-01 | Initial modular-monolith topology | Single TypeScript application; Next.js application with an integrated backend boundary; Next.js web plus NestJS API within one repository | Product Architect, Developer Lead, Security & Trust Guardian | Repository bootstrap |
| D-02 | Package manager and workspace model | `pnpm` workspace; a simpler single-package model if topology permits | Developer Lead | Dependency installation and CI |
| D-03 | Authentication and session strategy | Managed or self-hosted identity provider; email/phone requirements; session/MFA model | Security & Trust Guardian, Product | Identity milestone |
| D-04 | Authorization model | Role and permission model, resource scopes, organization/community boundaries, policy enforcement location | Security & Trust Guardian and domain owners | Identity and all writes |
| D-05 | Data access and migrations | PostgreSQL ORM/query layer, migration discipline, local/test database approach, identifier strategy | Developer Lead and Data/Analytics | Persistent features |
| D-06 | Environment and deployment baseline | Local/development/staging topology, cloud region, secrets ownership, hosting, logs, backups, recovery | DevOps/SRE and Compliance | CI/CD and deployment |
| D-07 | Localization and content workflow | Translation library, locale routing, translation ownership/review, locale fallback, Arabic-first copy acceptance | UX & Localization Specialist and Product | UI implementation |
| D-08 | First MVP vertical slice | Profile-first, community-first, or a combined minimal authenticated community flow | Product owner | Product feature implementation |

Each decision must be captured under `decisions/` with context, options, security/privacy implications, consequences, rollback/reversibility, and approval evidence. Decisions D-01, D-03, D-04, D-05, and D-06 are architecture or security material and must not be inferred from convenience alone. [3] [4]

## 4. Delivery Phases and Milestones

### Phase 0 — Decision Records and Repository Standards

This phase creates the decisions and standards needed to make subsequent code changes coherent and reversible. It does not introduce business features.

| Item | Affected domains | Planned files | Acceptance criteria |
|---|---|---|---|
| Architecture and foundation ADRs | Architecture, security, identity, data, delivery | `decisions/ADR-001-*.md` through the approved decision set; update `DECISION_LOG.md` | Each material decision documents alternatives, decision, consequences, security/privacy impact, rollback, and reviewer/owner status. |
| Repository conventions | Engineering, security, documentation | `.editorconfig`, `.gitignore`, `.nvmrc` or equivalent runtime declaration, `CONTRIBUTING.md`, `ENGINEERING_RULES.md` updates | The repository documents formatting, package policy, branch/commit expectations, secret exclusions, required checks, and contribution handoff. |
| Definition of initial foundation scope | Product, architecture, delivery | Update `MVP_SCOPE.md`, `IMPLEMENTATION_PLAN.md`, and this plan when decisions are approved | A bounded first vertical slice has measurable user value and explicit exclusions. |

**Security requirements:** no secrets in the repository; documented environment-variable contract uses placeholders only; all decisions identify sensitive data and authorization implications.

**Testing requirements:** documentation links resolve; Markdown linting or equivalent document validation is selected; no repository-quality check fails.

**Rollback:** ADRs are additive and reversible through superseding ADRs; no production configuration or data is changed.

### Phase 1 — Reproducible Application Bootstrap

This phase produces the smallest application foundation that can be installed, started, built, and checked locally and in CI. The exact topology follows D-01; the listed files are a planning target and must be adjusted to the approved ADR rather than created mechanically.

| Item | Affected domains | Candidate affected files | Acceptance criteria |
|---|---|---|---|
| Workspace and dependency definition | Platform, engineering | `package.json`, lockfile, workspace configuration, `.npmrc` if justified | A clean environment installs dependencies reproducibly; only reviewed, maintained dependencies are added. |
| Application scaffold | Experience and platform boundary | `apps/web/**` and/or `apps/platform/**`; configuration files; minimal entry point | The application starts locally, handles a basic health route/page, and builds with strict TypeScript. |
| Shared configuration | Platform, security | `packages/config/**` or topology-equivalent configuration module; `.env.example` | Environment inputs are validated at startup, documented, and never committed with real values. |
| Quality toolchain | Engineering, quality | TypeScript, formatter, linter, test runner configuration and scripts | Format, lint, type check, unit test, and production build commands exist and run deterministically. |
| CI foundation | Delivery, security | `.github/workflows/ci.yml`, dependency/security/license scan configuration where selected | Pull-request and branch checks install, format-check, lint, type-check, test, build, and scan dependencies. |

**Security requirements:** dependency review; lockfile integrity; secret scanning; least-privileged CI token permissions; configuration validation; no development bypass for security checks.

**Testing requirements:** a smoke test proves the application and health behavior; CI runs required commands from a clean checkout; build output is not committed.

**Documentation requirements:** update `README.md` with exact prerequisites and verified commands; update `CI_CD.md`, `DEVOPS.md`, and `TECHNOLOGY_STACK.md` if implementation differs from the documented target.

**Rollback:** remove the bootstrap branch/commit or revert individual additive commits; do not alter production environments.

### Phase 2 — Experience, Design System, and Localization Primitives

This phase establishes WCAG-oriented, Arabic-first reusable UI foundations before product pages are created. It turns the supplied visual direction into a coherent system without copying visual references or creating disconnected screens.

| Item | Affected domains | Candidate affected files | Acceptance criteria |
|---|---|---|---|
| Direction and locale framework | Experience, localization | Locale configuration, message catalogs for Arabic and English, layout direction utilities, locale persistence | Arabic is the default UX consideration; an explicit user choice is preserved; both Arabic/RTL and English/LTR render correctly. |
| Design tokens and primitives | Experience, accessibility | Token definitions, global styles, button/card/form/navigation/status components | Components use semantic HTML, visible focus, labels, keyboard navigation, sufficient contrast, reduced-motion support, and logical reading order. |
| Formatting and validation localization | Experience, localization | Date/number/currency helpers, localized validation/error messages | A representative date, number, currency, form validation, error, empty state, and loading state have Arabic and English coverage. |
| Responsive baseline | Experience | Layout primitives and responsive test fixtures | The application is usable on common mobile and desktop widths without horizontal overflow or direction regressions. |

**Security requirements:** no user-generated rich content rendering until sanitization and content policy are defined; locale selection must not trust unvalidated request values.

**Testing requirements:** unit tests for locale/direction/formatting helpers; component tests for keyboard and accessible labels; automated accessibility checks on the foundation route; visual or screenshot regression coverage for RTL and LTR where the selected toolchain supports it.

**Documentation requirements:** update `ARABIC_ENGLISH_LOCALIZATION.md`, `ACCESSIBILITY.md`, `DESIGN_SYSTEM.md`, and the README setup/usage notes.

**Rollback:** tokens and components are additive; locale routing changes require documented fallback behavior and test coverage before merge.

### Phase 3 — Identity, Authorization, and Professional Profile Foundation

This phase establishes the secure user boundary needed before any protected community, organization, trust, or AI workflow. It intentionally does not implement every possible role or verification feature.

| Item | Affected domains | Candidate affected files | Acceptance criteria |
|---|---|---|---|
| Account and session foundation | Identity, security, audit | Identity module, auth routes/controllers, session/cookie configuration, relevant database migrations | Registration/sign-in/sign-out or the approved equivalent works securely; error messages are safe and localized; session handling is tested. |
| Scoped authorization | Identity, organizations, community | Permission/policy module, request guards/middleware, role and scope model | Every protected operation has an explicit authorization decision; denied access is logged safely and cannot expose data. |
| Professional profile minimum | Profiles, privacy | Profile schema/migration, service/module, API or form, visibility controls | A member can create and edit the narrowly approved profile fields; visibility defaults and validation are tested. |
| Audit and operational baseline | Audit, observability | Audit-event definitions, correlation hooks, structured logger configuration | Authentication, authorization failures, profile changes, and privileged actions generate safe audit records without secrets. |

**Security requirements:** secure sessions; password/MFA practices appropriate to the approved provider; brute-force controls; CSRF/SSRF controls where architecture requires; data minimization; consent/visibility defaults; no raw stack traces.

**Testing requirements:** unit tests for policy rules; integration/API tests for authentication and authorization; negative permission tests; basic security tests for validation and rate limits; accessibility and localization coverage for sign-in/profile forms.

**Documentation requirements:** update `IDENTITY_AND_PROFILES.md`, `SECURITY_ARCHITECTURE.md`, `DATABASE_ARCHITECTURE.md`, `PRIVACY_AND_DATA_GOVERNANCE.md`, and API documentation.

**Rollback:** migrations must have an approved rollback or forward-fix strategy; feature flags or route controls prevent incomplete flows from exposure.

### Phase 4 — Community MVP Vertical Slice

This phase delivers a bounded valuable loop: an authorized member can discover a community, join under defined rules, create or participate in a discussion, and receive a controlled notification or in-app confirmation. It does not attempt to recreate external social platforms or implement every community feature at once.

| Item | Affected domains | Candidate affected files | Acceptance criteria |
|---|---|---|---|
| Community and membership model | Community, identity, audit | Community/membership modules, migrations, policy rules | Creation/administration scope, join rules, membership lifecycle, and audit events are explicit and tested. |
| Discussion minimum | Community, moderation | Post/comment modules, validation, content policy hooks, UI/API | Authorized members can create and read the approved content type; unauthorized, invalid, and abusive inputs are handled safely. |
| Discovery and states | Search, experience, localization | Community discovery route/API, filter primitives, empty/error/loading states | Members can find a limited approved set of communities using structured discovery; results obey authorization and privacy controls. |
| Reporting and moderation queue | Trust and Safety, moderation | Report model, queue/workflow, human review view or bounded operator action | Users can report content; automated systems may classify/prioritize only; high-impact action remains human-controlled. |

**Security requirements:** per-operation authorization, anti-spam/rate limiting, input validation and output encoding, safe rich-content policy, reporting/privacy safeguards, auditable moderation decisions, and no automatic high-impact enforcement.

**Testing requirements:** domain unit tests; integration tests for persistence/policies; API contract tests; E2E coverage for member join/post/report flows; accessibility coverage for forms and moderation reporting; abuse/rate-limit negative cases.

**Documentation requirements:** update `COMMUNITY_ENGINE.md`, `COMMUNITY_GOVERNANCE.md`, `TRUST_AND_SAFETY.md`, `API_ARCHITECTURE.md`, and any ADRs if the data/event/authorization model becomes material.

**Rollback:** route-level feature flag or equivalent exposure control; reversible migrations where safe; preserve audit evidence and do not silently delete report history.

### Phase 5 — Events and Structured Discovery

This phase extends the Community MVP with an event workflow and authorization-aware keyword/filter discovery. It precedes advanced matching and marketplace complexity.

| Item | Affected domains | Candidate affected files | Acceptance criteria |
|---|---|---|---|
| Event lifecycle | Events, community, notifications | Event module, migration, APIs/UI, attendance policy | Public/private event rules, capacity, registration, cancellation, attendance, and audit behaviors are coherent and tested. |
| Search baseline | Search, privacy | Search/query module, filters, API/UI | Keyword and structured filters work within authorization and privacy boundaries; results are paginated and safe. |
| Notifications minimum | Notifications, preferences | Preference model, in-app notification delivery | Members receive only the approved, preference-aware in-app notifications. |

### Phase 6 — Trust, Ecosystem Domains, Learning, and Marketplace Sequencing

After the MVP has evidence of use and operational readiness, add one bounded domain workflow at a time: explainable trust signals and moderation enhancement; experts/services/organizations; opportunities/partnerships; and LMS foundations. Marketplace and payments are explicitly gated behind legal/entity, provider, compliance, reconciliation, and dispute-resolution decisions. [5] [6]

### Phase 7 — Intelligence and Governed Automation

Only after identity, authorization, data classification, auditability, policy enforcement, and a bounded low-risk use case are operational should WB implement the AI gateway and a provider adapter. Initial work may support assistance, summarization, translation, or content drafting, but not autonomous high-impact actions. Matching, recommendations, and automation require fairness, monitoring, explainability, user control, human escalation, evaluation, cost tracking, and capability-policy controls. [7] [8]

## 5. Cross-Cutting Definition of Done

A change is not complete merely because it renders or compiles. Every implementation increment must satisfy the relevant portions of the following matrix.

| Dimension | Required evidence |
|---|---|
| Requirements | Linked requirement, explicit scope, acceptance criteria, and exclusions are understood. |
| Architecture | Domain boundary, ownership, interfaces, data access, and dependency direction are documented and respected. |
| Security and privacy | Threats, authorization, validation, data classification/minimization, secrets, logging, and safe errors are addressed. |
| Localization and accessibility | Arabic/English parity, RTL/LTR, locale formatting, semantic HTML, keyboard support, focus, labels, contrast, and state clarity are verified where user-facing. |
| Quality | Formatting, linting, strict type checking, focused unit tests, integration/API/E2E tests where appropriate, build, and regression checks pass. |
| Observability | Health, structured logs, correlation, metrics/traces where selected, and audit events for critical actions are present without sensitive data leakage. |
| Documentation | README, domain docs, API docs, operational documents, and ADRs are updated in the same change set when affected. |
| Delivery | CI passes; deployment/rollback implications are known; no unreviewed production effect occurs. |

## 6. Dependency and Risk Management

The delivery sequence is intentionally dependency-aware: quality and security gates precede feature breadth; localization primitives precede user-facing flows; identity and authorization precede protected community features; community and events precede commercial workflows; and regulated payment/AI autonomy work remains gated.

| Dependency or risk | Impact | Management approach |
|---|---|---|
| Unresolved foundation decisions | Could create expensive rework or insecure defaults | Complete and review D-01 through D-08 before dependent implementation. |
| Scope expansion | Could turn a focused MVP into disconnected screens | One milestone and one vertical slice at a time; explicitly document exclusions. |
| Dependency growth | Increases supply-chain and maintenance risk | Evaluate security, maintenance, license, performance, maturity, bundle, and vendor risk before each major dependency. |
| Arabic/English divergence | Harms product parity and accessibility | Treat both locales as acceptance criteria in every user-facing story. |
| Sensitive-data or payment work | Regulatory, privacy, and financial risk | Require compliance/legal/provider decisions and human review before build. |
| AI integration | Data leakage, prompt injection, tool abuse, unsafe autonomy | Use a policy-governed gateway after auth, audit, data classification, evaluations, and approval mechanisms exist. |
| Documentation drift | Loss of durable project context | Make documentation/ADR review part of pull-request and Definition-of-Done checks. |

## 7. First Build Increment Proposal

Subject to review of decisions D-01, D-02, D-06, D-07, and D-08, the first coding increment should be limited to **Repository Bootstrap and Quality Baseline**. It should not include authentication, database persistence, payments, external AI calls, user-generated content, production deployment, or a broad set of screens.

The first incremental commit group should include only the approved project configuration, initial application boundary, local environment contract, health route/page, strict type/check tooling, smoke test, CI workflow, README instructions, and the corresponding ADRs. It is successful only if a clean clone can install, check, test, build, and start the foundation with no secrets or undocumented setup.

## 8. Status and Next Action

This plan completes the repository-required **PLAN** stage. The next permitted mode is **BUILD**, beginning with the decision-record review and the approved Repository Bootstrap and Quality Baseline. If the platform owner does not approve the recommended decisions, implementation must pause at the relevant dependency gate rather than invent an irreversible architecture, identity, deployment, payment, or AI policy.

## References

[1]: ./ROADMAP.md "WB Roadmap"
[2]: ./IMPLEMENTATION_PLAN.md "Repository Implementation Plan"
[3]: ./PROJECT_CONSTITUTION.md "WB Project Constitution"
[4]: ./PROJECT_INSTRUCTIONS.md "WB Project Instructions"
[5]: ./PAYMENT_AND_ESCROW.md "Payments and Escrow-like Settlement"
[6]: ./SAUDI_COMPLIANCE_MATRIX.md "Saudi Compliance Applicability Matrix"
[7]: ./AI_ARCHITECTURE.md "AI Architecture"
[8]: ./AI_GUARDRAILS.md "AI Guardrails"
