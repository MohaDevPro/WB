## Uncle Bob Metrics Report

**Target**: apps/api/src (V0 backend)
**Language**: TypeScript
**Agent / Environment**: WB Modular Monolith

| Metric | Result | Threshold | Status | Notes |
|---|---:|---:|:---:|---|
| Test Coverage | 100% lines / 100% branches | ≥ 80% lines / branches | ✅ | Vitest v8 report |
| Cyclomatic Complexity | max = 34 | ≤ 10 | ⚠️ | Approximation from decision tokens; inspect high-complexity services |
| Module / Function Sizes | max file = 312 LOC; max function = 87 LOC | ≤ 300 / ≤ 40 | ⚠️ | Large legacy service modules remain candidates for extraction |
| Dependency Structure | 0 cycle(s) | 0 cycles | ✅ | Relative imports only |
| Mutation Score | 92.31% | ≥ 70% | ✅ | Stryker on V0 rules |

### Key Findings

The V0 boundary rules now have direct tests for password, phone, content, visibility, membership, and registration behavior. The metrics report deliberately separates hard gates from refactoring signals: coverage, mutation, and dependency cycles gate CI; large service files and high complexity produce actionable warnings rather than hiding existing technical debt.

No circular relative dependencies were detected.

### Recommended Actions

1. Keep mutation score above 70% whenever V0 rules change.
2. Split service modules above 300 LOC when the next feature touches them.
3. Add integration tests around database transactions and authorization as the test database harness is introduced.

### Gate Result

✅ All hard quality gates passed.
