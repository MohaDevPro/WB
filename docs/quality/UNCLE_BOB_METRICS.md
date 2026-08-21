## Uncle Bob Metrics Report

**Target**: apps/api/src (V0 backend)
**Language**: TypeScript
**Agent / Environment**: WB Modular Monolith

| Metric | Result | Threshold | Status | Notes |
|---|---:|---:|:---:|---|
| Test Coverage | 100% lines / 100% branches | ≥ 80% lines / branches | ✅ | Vitest v8 report |
| Cyclomatic Complexity | max = 5 | ≤ 10 | ✅ | Approximation from decision tokens; inspect high-complexity services |
| Module / Function Sizes | max file = 276 LOC; max function = 38 LOC | ≤ 300 / ≤ 40 | ✅ | All measured backend modules are within the size thresholds |
| Dependency Structure | 0 cycle(s) | 0 cycles | ✅ | Relative imports only |
| Mutation Score | 92.31% | ≥ 70% | ✅ | Stryker on V0 rules |

### Key Findings

The V0 boundary rules now have direct tests for password, phone, content, visibility, membership, and registration behavior. The metrics report keeps the five quality signals explicit: coverage, mutation, complexity, module/function size, and dependency structure are measured on every quality run.

No circular relative dependencies were detected.

### Recommended Actions

1. Keep mutation score above 70% whenever V0 rules change.
2. Keep new service modules at or below 300 LOC and functions at or below 40 LOC.
3. Add integration tests around database transactions and authorization as the test database harness is introduced.

### Gate Result

✅ All hard quality gates passed.
