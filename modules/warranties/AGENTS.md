# Warranties Module

Product warranty plans, registrations, and claims management.

## File structure

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

## Key patterns

- Expiration calculated from `purchaseDate + plan.durationMonths`
- Claims validate: registration active, customer ownership, warranty not expired
- Plans with active registrations cannot be deleted
- Inactive plans cannot be used for new registrations

## Events emitted

`warranty.registered`, `warranty.expired`, `warranty.voided`, `claim.submitted`, `claim.approved`, `claim.denied`, `claim.resolved`, `claim.closed`
