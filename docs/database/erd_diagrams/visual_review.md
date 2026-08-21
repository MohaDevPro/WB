# WB ERD Visual Review

## 2026-08-21

The Architecture Map rendered successfully at 3120x1436 and is readable. It clearly shows PostgreSQL as one database per environment, the Schema Modules, Cross-schema ownership links, Redis, and private S3-compatible storage.

The generated Core ERD is technically complete but visually too wide and compressed at 3120x376 because it contains all Core tables in one horizontal graph. It should not be the primary review diagram. The core graph must be split into smaller diagrams: Auth/Profile/Community and Content/Event/System. The full combined graph remains available as a reference only.

The Mermaid sources are generated from `database/migrations/002_modular_schemas.sql`; table/column drift is therefore prevented at source level. After splitting, each PNG must be opened and reviewed again before commit.

The split Auth/Profile/Community and Content/Event/System diagrams rendered successfully. They remain wide because the complete schema and all typed Foreign Keys are intentionally shown, but their heights and density are substantially more reviewable than the former single Core graph. The split diagrams are the recommended review surfaces; the combined graph remains reference-only.
