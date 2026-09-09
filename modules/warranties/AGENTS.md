# Warranties Module

Product warranty plans, registrations, and claims management.

**Scope:** This guide owns Module-specific mechanics. In the 86d.store source checkout, read the repository root [`AGENTS.md`](../../AGENTS.md) for shared rules and gates. In another project, follow that project's instructions and the installed `@86d-app/core` contracts.

## Change protocol

1. **Route.** Read this guide and the Module's [`README.md`](./README.md). In the 86d.store source checkout, storage or cross-Module changes also follow the root [Module contracts](../../AGENTS.md#module-contracts) routes.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** In the 86d.store source checkout, run `bun run generate:modules` after a Module change, then `bun run generate:modules -- --frozen` and the parent gates. In another project, use that project's checks. Run the Module's focused tests when available.
   - Done when the current project's required checks pass; source-checkout work also requires a passing frozen registry check.

## Structure

```
src/
  index.ts              Factory (WarrantiesOptions), admin nav, events
  schema.ts             3 models: warrantyPlan, warrantyRegistration, warrantyClaim
  service.ts            Types + WarrantyController interface
  service-impl.ts       createWarrantyController(data) implementation
  mdx.d.ts              MDX module declaration
  __tests__/
    service-impl.test.ts  74 tests covering plans, registrations, claims, workflow
  admin/
    endpoints/            17 endpoints (plan CRUD, registration mgmt, claim workflow)
    components/           WarrantiesList, ClaimDetail (TSX + MDX)
  store/
    endpoints/            6 endpoints (browse plans, view warranties, submit/view claims)
    components/           WarrantyStatus, ClaimForm (TSX + MDX)
```

## Data models

- **warrantyPlan**: id, name, description, type (manufacturer|extended|accidental_damage), durationMonths, price, coverageDetails, exclusions, isActive, productId
- **warrantyRegistration**: id, warrantyPlanId, orderId, customerId, productId, productName, serialNumber, purchaseDate, expiresAt, status (active|expired|voided|claimed), voidReason
- **warrantyClaim**: id, warrantyRegistrationId, customerId, issueType, issueDescription, status (submitted|under_review|approved|denied|in_repair|resolved|closed), resolution, resolutionNotes, adminNotes, submittedAt, resolvedAt

## Claim status flow

```
submitted → under_review → approved → in_repair → resolved → closed
                ↘                ↘         ↗
              denied            resolved
```

Admin can deny at any non-terminal stage. Resolve can follow `approved` or `in_repair`.

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoRegisterOnPurchase` | boolean | false | Auto-register manufacturer warranties on order completion |

## Patterns

- Expiration calculated from `purchaseDate + plan.durationMonths`
- Claims validate: registration active, customer ownership, warranty not expired
- Plans with active registrations cannot be deleted
- Inactive plans cannot be used for new registrations

## Events

`warranty.registered`, `warranty.expired`, `warranty.voided`, `claim.submitted`, `claim.approved`, `claim.denied`, `claim.resolved`, `claim.closed`
