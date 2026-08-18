# WB — Project Instructions

## 1. Project Identity

Project: WB

Repository: https://github.com/ma1amin/WB

WB is an AI-native community and professional ecosystem platform originating from the Arab market.

WB combines:

- Community
- Professional identity
- Networking
- Knowledge sharing
- Events
- Experts
- Learning
- Opportunities
- Partnerships
- Professional services
- Organizations
- Marketplace transactions
- Trust and reputation
- AI-assisted discovery
- AI-powered matching
- AI-assisted moderation
- AI-powered personalization
- Ecosystem intelligence
- Controlled autonomous operations

WB must not be implemented as a collection of unrelated features.

It is an integrated ecosystem where each major capability strengthens the others.

The core ecosystem loop is:

Discover → Connect → Learn → Collaborate → Provide/Obtain Value → Complete → Review → Build Trust → Contribute → Discover Again


## 2. Project Objective

Build a production-grade, scalable, secure, multilingual, AI-native platform that allows individuals and organizations to:

- discover people
- build professional identities
- join communities
- create and participate in groups
- attend events
- learn
- teach
- provide services
- obtain services
- discover opportunities
- find partners
- create organizations
- collaborate
- transact
- build professional reputation
- contribute knowledge
- use AI to navigate and operate within the ecosystem


## 3. Strategic Position

WB should launch as a community platform with professional and ecosystem capabilities.

It should evolve into a broader ecosystem platform.

The architecture must therefore support:

Level 1:
Community

Level 2:
Professional Network

Level 3:
Knowledge and Learning Platform

Level 4:
Professional Services Marketplace

Level 5:
AI-Native Ecosystem Operating Layer

The architecture should be designed for Level 5.

The initial product should launch around Level 2–3 complexity.

Do not attempt to implement the entire Level 5 vision in the first release.


## 4. Product Principles

The following principles are mandatory.

### 4.1 Trust Before Growth

User growth must never justify weakening:

- security
- privacy
- moderation
- identity integrity
- transaction integrity
- trust signals
- platform reliability

### 4.2 Community First

The community remains valuable even when users do not purchase anything.

The free core community is fundamental to the product.

### 4.3 Ecosystem Value

WB should create practical value beyond conversation.

Users should be able to:

- learn
- meet
- collaborate
- find work
- find experts
- offer services
- obtain services
- find partners
- build credibility

### 4.4 AI Is Infrastructure

AI is not a decorative chatbot.

AI should eventually operate across:

- discovery
- search
- matching
- recommendations
- moderation
- onboarding
- support
- learning
- analytics
- operations
- content assistance
- ecosystem intelligence

AI must remain governed.

### 4.5 Human Control

High-impact decisions must remain subject to human oversight.

AI can recommend.

AI can classify.

AI can prioritize.

AI can automate low-risk workflows.

AI must not independently perform unrestricted high-impact actions.


## 5. Product Language

WB supports:

- Arabic
- English

Both languages are first-class.

Arabic is the primary UX consideration.

English must receive equivalent functional support.

The platform must support:

- RTL
- LTR
- locale-aware dates
- locale-aware numbers
- locale-aware currencies
- localized validation
- localized errors
- localized notifications
- localized emails
- localized system messages

Language selection priority:

1. Explicit account preference
2. Explicit session preference
3. Browser language
4. Platform default

Never silently override an explicit user choice.


## 6. UX Philosophy

WB must feel:

- professional
- trustworthy
- modern
- approachable
- efficient
- intelligent
- human

Avoid unnecessary visual complexity.

Avoid feature overload.

Avoid dark patterns.

Avoid manipulative engagement mechanics.

Use:

- strong hierarchy
- predictable navigation
- meaningful whitespace
- clear actions
- contextual information
- progressive disclosure
- useful empty states
- useful error states
- strong accessibility

The UI must be built from a coherent design system.

Do not reproduce individual screenshots as disconnected pages.

The attached visual references are inspiration for product structure and ecosystem density, not permission to copy another product's interface or intellectual property.


## 7. Accessibility

Target:

WCAG 2.2 AA.

Accessibility is part of Definition of Done.

All major components must support:

- keyboard navigation
- screen readers
- visible focus
- semantic HTML
- accessible labels
- accessible forms
- sufficient contrast
- logical reading order
- RTL
- reduced motion
- usable touch targets


## 8. Architecture

Start with a modular monolith.

Do not introduce microservices simply because the platform is large.

Use explicit domain boundaries.

Potential domains include:

- Identity
- Profiles
- Organizations
- Community
- Groups
- Discussions
- Events
- Learning
- Experts
- Services
- Opportunities
- Partnerships
- Marketplace
- Payments
- Settlement
- Messaging
- Notifications
- Search
- Matching
- Trust
- Moderation
- Advertising
- Analytics
- AI
- Files
- Audit
- Compliance

Each domain must have:

- ownership
- business rules
- interfaces
- authorization rules
- tests
- observability
- lifecycle
- documentation

Extract services only when justified by:

- scale
- performance
- security isolation
- independent deployment
- team ownership
- reliability
- operational necessity


## 9. Technology Stack

Preferred baseline:

Frontend:

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

Backend:

- NestJS
- TypeScript

Database:

- PostgreSQL

Caching:

- Redis

Storage:

- S3-compatible object storage

API:

- REST
- OpenAPI

Realtime:

- WebSockets when justified

Search:

- PostgreSQL search initially
- OpenSearch when scale or semantic search requirements justify it

Infrastructure:

- Docker
- Infrastructure as Code
- CI/CD

Observability:

- OpenTelemetry-compatible telemetry

Testing:

- unit
- integration
- API
- E2E
- security
- accessibility
- performance

AI:

- provider-agnostic AI Gateway


## 10. Cloud Strategy

Google Cloud is the recommended primary cloud platform.

The architecture must remain cloud-agnostic.

Use a Saudi region where required services are available and appropriate.

Sensitive workloads must be deployable into approved Saudi infrastructure where regulatory, contractual, or risk requirements demand it.

Avoid unnecessary vendor lock-in.

Cloud-specific services may be used where they provide substantial value, but business logic must not become inseparable from one provider.


## 11. Initial Scale

The initial operating assumption is approximately:

1,000 users.

The architecture must nevertheless support growth toward:

10,000
100,000
1,000,000+

Scaling decisions must be evidence-driven.

Do not optimize for hypothetical billions of users while the product is still validating product-market fit.


## 12. Repository Strategy

Use one repository initially.

Maintain clear boundaries.

Recommended structure:

WB/

apps/
packages/
services/
infrastructure/
docs/
ai/
skills/
tests/
scripts/
governance/
decisions/
roadmap/

Important root files:

README.md
AGENTS.md
PROJECT-INSTRUCTIONS.md
PROJECT_CONSTITUTION.md
LICENSE


## 13. Database Principles

PostgreSQL is the transactional system of record.

Use:

- migrations
- constraints
- indexes
- foreign keys
- transaction boundaries
- appropriate normalization
- explicit ownership

Do not expose database structures directly through APIs.

Financial records must be auditable.

Financial history must not be silently rewritten.

Use compensating entries where appropriate.

Store timestamps consistently in UTC.


## 14. API Rules

Every API must have:

- authentication
- authorization
- validation
- rate limiting
- error handling
- observability
- documentation
- audit requirements where applicable

Never expose:

- secrets
- stack traces
- internal credentials
- unnecessary personal data
- authorization internals


## 15. Identity

One person has one primary WB identity.

A user may have multiple roles.

Examples:

- Member
- Expert
- Mentor
- Service Provider
- Instructor
- Partner
- Organization Administrator
- Community Administrator

Roles are additive.

Do not create separate accounts merely because the user's role changes.


## 16. Professional Identity

Professional profiles may include:

- biography
- skills
- expertise
- experience
- education
- certifications
- portfolio
- services
- languages
- location
- availability
- organizations
- communities
- verified attributes
- trust badges
- selected contributions

Users control visibility.


## 17. Trust Engine

WB uses a unified internal Trust Engine.

The public UX must not reduce a person to one mysterious numerical score.

Instead expose understandable signals such as:

- Identity Verified
- Professional Evidence Verified
- Experienced Provider
- Community Contributor
- Reliable Service Provider
- Verified Organization
- Trusted Instructor
- Event Contributor

Trust signals must be explainable and reviewable.

Users must have appropriate appeal mechanisms.


## 18. Community Engine

Build a generalized Community Engine.

It must support:

- communities
- groups
- channels
- posts
- comments
- reactions
- polls
- memberships
- roles
- events
- moderation
- reports
- contribution signals

External platforms such as:

- WhatsApp
- Telegram
- LinkedIn
- YouTube
- X
- Instagram

are initially treated as links.

Do not attempt to rebuild them.


## 19. Events

Support:

- online events
- physical events
- hybrid events
- recurring events
- paid events
- private events
- public events
- speakers
- attendance
- recordings
- certificates
- networking
- post-event discussion


## 20. Learning

Build a scalable LMS.

Support:

- instructors
- courses
- programs
- modules
- lessons
- video
- documents
- quizzes
- assignments
- assessments
- progress
- certificates
- cohorts
- discussions
- reviews
- payments
- AI assistance

Certificate verification must be supported.


## 21. Marketplace

Marketplace supports:

- professional services
- experts
- consulting
- courses
- training
- projects
- future commercial offerings

Workflow:

Discovery
→ Request
→ Provider response
→ Agreement
→ Payment
→ Delivery
→ Acceptance
→ Settlement
→ Review

Support:

- cancellation
- refund
- dispute
- evidence
- chargeback handling
- reconciliation


## 22. Payments

The payment layer must be provider-agnostic.

Support integration architecture for multiple providers, including where legally and commercially available:

- mada
- STC Pay
- Apple Pay
- Visa/Mastercard-capable gateways
- Stripe
- other approved Saudi-compatible providers

Do not hard-code business logic to one payment gateway.

WB should use regulated payment infrastructure for holding funds.

Do not implement an internal custodial wallet unless the legal and regulatory structure explicitly permits it.

The system must support:

- authorization
- payment
- hold
- release
- settlement
- payout
- refund
- cancellation
- dispute
- reconciliation

All financial operations must be:

- idempotent
- auditable
- secure


## 23. Opportunities

Support:

- jobs
- projects
- internships
- volunteering
- professional opportunities
- collaboration requests
- partnership requests

Core workflow:

Create
→ Discover
→ Match
→ Contact
→ Discuss
→ Agree
→ Collaborate
→ Complete
→ Review


## 24. Organizations

Organizations may have:

- profiles
- employees
- teams
- services
- jobs
- events
- courses
- partnerships
- sponsored content
- reputation
- analytics

Organization permissions must be scoped.

No administrator should automatically receive unrestricted access to every organizational capability.


## 25. Search

Search should evolve through stages.

Stage 1:

- keyword
- filters
- structured search

Stage 2:

- semantic search
- embeddings
- relevance ranking

Stage 3:

- intent understanding
- AI-assisted search
- conversational discovery

Search must respect authorization and privacy.


## 26. Matching

Matching may use:

- skills
- expertise
- experience
- location
- availability
- language
- interests
- industry
- preferences
- trust signals

Do not use sensitive attributes for unfair exclusion.

AI recommendations must remain distinguishable from verified facts.


## 27. Messaging

Messaging supports:

- user-to-user
- user-to-provider
- organization communication
- opportunity communication
- community communication

Messaging requires:

- abuse prevention
- rate limiting
- reporting
- blocking
- privacy controls
- retention rules


## 28. Notifications

Support:

- in-app
- email
- push
- SMS
- WhatsApp
- Telegram

where technically, commercially, and legally appropriate.

Users control notification preferences.

Do not spam users.


## 29. Gamification

Use gamification to reward useful contribution.

Examples:

- badges
- achievements
- contribution levels
- challenges
- recognition
- leaderboards
- rewards

Do not reward:

- spam
- artificial engagement
- manipulation
- harassment
- low-quality content


## 30. Advertising

WB may support:

- sponsorships
- featured organizations
- event sponsorship
- ecosystem promotions
- paid placement
- traditional advertising

Paid placement must always be identifiable.

Advertising must never secretly influence:

- trust
- verification
- moderation
- safety decisions


## 31. Business Model

Core community:

Free.

Paid ecosystem:

- professional services
- marketplace transactions
- premium capabilities
- organizations
- courses
- sponsorships
- advertising
- premium AI
- usage-based AI

Exact pricing is not fixed yet.

Pricing decisions must be based on:

- market research
- unit economics
- payment costs
- tax
- user research
- supply/demand
- willingness to pay


## 32. AI Architecture

AI must use a provider-agnostic architecture.

Implement an AI Gateway.

The gateway abstracts:

- model providers
- models
- prompts
- context
- tools
- embeddings
- retrieval
- token usage
- cost
- safety
- evaluation

Possible providers may change.

Do not build the platform around one AI vendor.


## 33. AI Orchestration Roles

Core AI orchestration roles:

### Product Architect

Owns product architecture and system coherence.

### AI Systems Designer

Owns AI architecture, agents, tools, retrieval, evaluations, and model strategy.

### Security & Trust Guardian

Challenges security, privacy, abuse, fraud, AI safety, and trust risks.

### Ecosystem Strategist

Protects ecosystem health, business model, network effects, and platform coherence.

### Developer Lead

Owns implementation quality, engineering standards, architecture integrity, and code quality.

### UX & Localization Specialist

Owns usability, accessibility, Arabic, English, RTL, localization, and design-system consistency.

Supporting agents:

- QA Agent
- DevOps/SRE Agent
- Data & Analytics Agent
- Compliance Agent
- Community Intelligence Agent


## 34. AI Capability Levels

WB is architected for Level 5 autonomy.

Launch around Level 2–3.

Level 0:
Human only.

Level 1:
AI assists.

Level 2:
AI recommends.

Level 3:
AI executes approved workflows.

Level 4:
AI autonomously executes bounded workflows.

Level 5:
AI orchestrates complex multi-agent workflows within defined boundaries.


## 35. AI Risk Classes

### Low Risk

Examples:

- summarization
- translation
- drafting
- categorization

May be automated.

### Medium Risk

Examples:

- recommendations
- matching
- content assistance
- onboarding

Must have controls and monitoring.

### High Risk

Examples:

- financial actions
- account suspension
- identity decisions
- privileged operations
- sensitive data access
- production deployment

Require human approval or explicit policy-controlled authorization.


## 36. AI Guardrails

AI must:

- respect authorization
- never expose secrets
- never fabricate system state
- never invent credentials
- validate tool inputs
- minimize sensitive context
- record high-risk actions
- escalate uncertainty
- preserve user control
- avoid irreversible actions without authorization
- distinguish facts from inference
- respect privacy
- follow platform policy

AI must never bypass:

- IAM
- security controls
- payment controls
- compliance controls
- audit controls


## 37. Prompt Injection Defense

Treat external content as untrusted.

This includes:

- user messages
- documents
- websites
- uploaded files
- community posts
- third-party APIs

Never allow retrieved content to redefine system instructions.

Tool execution must be governed by explicit capability policies.


## 38. Human Moderation

Moderation is hybrid:

AI + human.

AI may:

- classify
- detect
- prioritize
- recommend
- summarize

Human operators handle high-impact decisions.

Users must have appropriate reporting and appeal mechanisms.


## 39. Security Baseline

Baseline:

OWASP ASVS Level 2.

Additional references:

- OWASP Top 10
- OWASP API Security Top 10
- NIST CSF
- CIS Controls
- ISO/IEC 27001 principles
- applicable Saudi cybersecurity requirements

These references do not automatically constitute compliance certification.


## 40. Security Requirements

Implement:

- secure authentication
- authorization
- MFA where appropriate
- least privilege
- secure sessions
- rate limiting
- secure headers
- input validation
- output encoding
- CSRF protections where applicable
- SSRF protection
- secure file handling
- secrets management
- encryption
- audit logs
- dependency scanning
- supply-chain security
- security monitoring


## 41. Privacy

Use:

- data minimization
- purpose limitation
- access control
- retention controls
- transparency
- user controls
- secure processing
- auditability

Classify data:

Public
Internal
Confidential
Sensitive
Highly Sensitive


## 42. Saudi Compliance

The platform must be designed around applicable Saudi requirements.

Relevant areas include:

- Personal Data Protection Law
- cybersecurity requirements
- e-commerce
- electronic transactions
- consumer protection
- VAT
- e-invoicing
- payments
- advertising
- cloud and data requirements

Applicability must be validated against the final legal entity and actual business activities.

Never claim compliance merely because a document exists.


## 43. Observability

Implement:

- logs
- metrics
- traces
- health checks
- audit events
- correlation IDs

Never log:

- passwords
- secrets
- payment credentials
- authentication tokens
- unnecessary sensitive information


## 44. Testing

Required testing layers:

- unit
- integration
- API
- E2E
- accessibility
- security
- performance

Critical workflows receive stronger testing:

- authentication
- authorization
- payments
- settlement
- identity
- trust
- moderation
- AI tools


## 45. CI/CD

CI must include:

- formatting
- linting
- type checking
- tests
- security scanning
- dependency scanning
- license checks
- build validation

Protected branches require successful gates.


## 46. Documentation

Documentation is part of the product.

Whenever architecture or behaviour changes:

Update the appropriate Markdown documentation.

Do not allow documentation to become disconnected from implementation.


## 47. Decision Records

Create an Architecture Decision Record when a decision:

- is difficult to reverse
- affects multiple domains
- affects security
- affects compliance
- affects data architecture
- affects payments
- affects AI autonomy
- introduces significant infrastructure dependency


## 48. AI Execution Modes

### DISCUSS

Understand.

Do not implement.

### PLAN

Create implementation plan.

Do not implement until authorized.

### BUILD

Implement approved work.

Run validation.

### AUDIT

Review without changing unless explicitly instructed.


## 49. Definition of Done

A feature is complete only when:

- requirements are understood
- architecture is respected
- implementation is complete
- tests pass
- security is addressed
- accessibility is addressed
- localization is addressed
- observability exists
- documentation is updated
- acceptance criteria pass
- deployment implications are understood


## 50. Dependency Rules

Do not introduce a dependency merely for convenience.

Before adding one evaluate:

- maintenance
- license
- security
- bundle size
- performance
- maturity
- community
- vendor risk

Document material dependencies.


## 51. Coding Rules

Prefer:

- explicit code
- small modules
- strong typing
- clear naming
- deterministic logic
- testable business rules
- dependency inversion
- domain boundaries

Avoid:

- hidden global state
- circular dependencies
- unnecessary abstraction
- premature optimization
- duplicate logic
- magic constants


## 52. Error Handling

Errors must be:

- predictable
- structured
- safe
- observable
- useful

Never expose internal implementation details to users.


## 53. Secrets

Never commit:

- passwords
- API keys
- tokens
- private certificates
- cloud credentials
- database credentials

Use secure secret management.


## 54. Production

Production changes require:

- validation
- observability
- rollback consideration
- appropriate approval
- auditability

High-risk production changes require explicit authorization.


## 55. Repository Source of Truth

When information conflicts:

1. Current approved repository implementation
2. Project Constitution
3. Project Instructions
4. Domain documentation
5. Architecture Decision Records
6. Task instructions
7. AI assumptions

If the conflict affects security, money, privacy, identity, trust, or compliance, stop and escalate.


## 56. AI Agent Behaviour

AI agents must not pretend that work was completed.

If a command failed:

Report it.

If a test was not run:

Say so.

If a dependency is unavailable:

Say so.

If requirements are ambiguous:

Ask or document the ambiguity.

Never manufacture evidence.


## 57. Research

When external research is required:

- prefer authoritative sources
- distinguish fact from interpretation
- record important sources
- avoid unsupported claims
- validate time-sensitive information


## 58. Final Principle

Build WB as a durable platform, not a prototype that happens to have many screens.

The goal is:

Simple for users.

Structured for developers.

Safe for operators.

Useful for communities.

Scalable for business.

Governed for AI.

Trustworthy by design.