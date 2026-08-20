

# @86d-app/warranties

📚 **Documentation:** [86d.app/docs/modules/warranties](https://86d.app/docs/modules/warranties)

Product warranty management for 86d commerce platform. Create warranty plans, register customer warranties, and process warranty claims with a full approval workflow.

## Installation

```ts
import warranties from "@86d-app/warranties";

export default defineStore({
  modules: [
    warranties({
      autoRegisterOnPurchase: false,
    }),
  ],
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoRegisterOnPurchase` | `boolean` | `false` | Auto-register manufacturer warranties on order completion |

## Entities

### Warranty Plan

Defines what a warranty covers, how long it lasts, and its price.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique plan ID |
| `name` | `string` | Plan name |
| `description` | `string?` | Plan description |
| `type` | `manufacturer \| extended \| accidental_damage` | Coverage type |
| `durationMonths` | `number` | How long the warranty lasts |
| `price` | `number` | Price (0 for included warranties) |
| `coverageDetails` | `string?` | What's covered |
| `exclusions` | `string?` | What's not covered |
| `isActive` | `boolean` | Whether plan accepts new registrations |
| `productId` | `string?` | Specific product this plan applies to |

### Warranty Registration

Links a warranty plan to a customer's purchased product.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique registration ID |
| `warrantyPlanId` | `string` | Associated warranty plan |
| `orderId` | `string` | Original purchase order |
| `customerId` | `string` | Customer who owns the warranty |
| `productId` | `string` | Product covered |
| `productName` | `string` | Product display name |
| `serialNumber` | `string?` | Product serial number |
| `purchaseDate` | `Date` | When the product was purchased |
| `expiresAt` | `Date` | When warranty coverage ends |
| `status` | `active \| expired \| voided \| claimed` | Registration status |

### Warranty Claim

A customer's request for warranty service.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique claim ID |
| `warrantyRegistrationId` | `string` | Associated registration |
| `customerId` | `string` | Customer filing the claim |
| `issueType` | `defect \| malfunction \| accidental_damage \| wear_and_tear \| missing_parts \| other` | Type of issue |
| `issueDescription` | `string` | Customer's description |
| `status` | `submitted \| under_review \| approved \| denied \| in_repair \| resolved \| closed` | Claim status |
| `resolution` | `repair \| replace \| refund \| credit` | How the claim was resolved |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/warranties` | List customer's warranty registrations |
| `GET` | `/warranties/plans` | List available warranty plans (active only) |
| `GET` | `/warranties/claims` | List customer's warranty claims |
| `POST` | `/warranties/claims/submit` | Submit a new warranty claim |
| `GET` | `/warranties/claims/:id` | Get claim details |
| `GET` | `/warranties/:id` | Get warranty registration details |

## Admin Endpoints

### Plans

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/warranties/plans` | List all warranty plans |
| `POST` | `/admin/warranties/plans/create` | Create a warranty plan |
| `PUT` | `/admin/warranties/plans/:id` | Update a warranty plan |
| `DELETE` | `/admin/warranties/plans/:id/delete` | Delete a warranty plan |

### Registrations

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/warranties/registrations` | List all registrations |
| `POST` | `/admin/warranties/registrations/create` | Register a warranty |
| `GET` | `/admin/warranties/registrations/:id` | Get registration details |
| `POST` | `/admin/warranties/registrations/:id/void` | Void a registration |

### Claims

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/warranties/claims` | List all claims |
| `GET` | `/admin/warranties/claims/summary` | Get claim statistics |
| `GET` | `/admin/warranties/claims/:id` | Get claim details |
| `POST` | `/admin/warranties/claims/:id/review` | Start reviewing a claim |
| `POST` | `/admin/warranties/claims/:id/approve` | Approve a claim |
| `POST` | `/admin/warranties/claims/:id/deny` | Deny a claim |
| `POST` | `/admin/warranties/claims/:id/repair` | Mark claim as in repair |
| `POST` | `/admin/warranties/claims/:id/resolve` | Resolve a claim |
| `POST` | `/admin/warranties/claims/:id/close` | Close a resolved claim |

## Controller API

```ts
interface WarrantyController {
  // Plans
  createPlan(params: CreateWarrantyPlanParams): Promise<WarrantyPlan>;
  updatePlan(id: string, params: UpdateWarrantyPlanParams): Promise<WarrantyPlan | null>;
  getPlan(id: string): Promise<WarrantyPlan | null>;
  listPlans(params?): Promise<WarrantyPlan[]>;
  deletePlan(id: string): Promise<boolean>;

  // Registrations
  register(params: RegisterWarrantyParams): Promise<WarrantyRegistration>;
  getRegistration(id: string): Promise<WarrantyRegistration | null>;
  getRegistrationsByCustomer(customerId: string, params?): Promise<WarrantyRegistration[]>;
  listRegistrations(params?): Promise<WarrantyRegistration[]>;
  voidRegistration(id: string, reason: string): Promise<WarrantyRegistration | null>;

  // Claims
  submitClaim(params: SubmitClaimParams): Promise<WarrantyClaim>;
  getClaim(id: string): Promise<WarrantyClaim | null>;
  getClaimsByRegistration(id: string): Promise<WarrantyClaim[]>;
  getClaimsByCustomer(customerId: string, params?): Promise<WarrantyClaim[]>;
  listClaims(params?): Promise<WarrantyClaim[]>;
  reviewClaim(id: string, adminNotes?): Promise<WarrantyClaim | null>;
  approveClaim(id: string, resolution: ClaimResolution, adminNotes?): Promise<WarrantyClaim | null>;
  denyClaim(id: string, adminNotes?): Promise<WarrantyClaim | null>;
  startRepair(id: string, adminNotes?): Promise<WarrantyClaim | null>;
  resolveClaim(id: string, resolutionNotes?): Promise<WarrantyClaim | null>;
  closeClaim(id: string): Promise<WarrantyClaim | null>;
  getClaimSummary(): Promise<ClaimSummary>;
}
```

## Claim Workflow

```
submitted → under_review → approved → in_repair → resolved → closed
                ↘                ↘         ↗
              denied            resolved
```

- Claims can only be submitted against **active**, non-expired registrations
- Customer must own the warranty registration
- Admin can deny at any non-terminal stage
- Resolution can follow `approved` or `in_repair` status
- Only `resolved` claims can be closed

## Store Components

| Component | Description |
|-----------|-------------|
| `WarrantyStatus` | Lists customer's registered warranties |
| `ClaimForm` | Form to submit a warranty claim |

### Admin Components

| Component | Description |
|-----------|-------------|
| `WarrantiesList` | Dashboard with claim summary and claim list |
| `ClaimDetail` | Detailed view of a single claim |

## Notes

- Plans with active registrations cannot be deleted
- Inactive plans cannot be used for new registrations
- Warranty expiration is calculated as `purchaseDate + plan.durationMonths`
- All monetary values (price) are in the store's default currency
