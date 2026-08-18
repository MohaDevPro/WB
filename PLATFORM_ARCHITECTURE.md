# Platform Architecture

WB starts as a modular monolith. Each domain has explicit boundaries, contracts, data ownership, services, events, tests, and authorization policies. Service extraction occurs only when scale, reliability, security, team ownership, or deployment independence justifies it.

Core modules include Identity, Community, Events, Learning, Marketplace, Services, Experts, Partnerships, Opportunities, Organizations, Payments, Settlement, Messaging, Notifications, Search, Matching, Trust, Moderation, Advertising, Analytics, AI, Files, Audit, and Compliance.

Use synchronous APIs for direct operations and asynchronous domain events for workflows that benefit from decoupling.

A module owns its transactional data. Other modules access it through interfaces or published events rather than direct table coupling.

REST/OpenAPI is the default external interface. WebSockets are used only where real-time behaviour adds clear value.
