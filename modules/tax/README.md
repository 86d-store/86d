<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  Dynamic Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk.

# Tax Module

📚 **Documentation:** [86d.app/docs/modules/tax](https://86d.app/docs/modules/tax)

Tax calculation, nexus management, transaction auditing, and compliance reporting for the 86d commerce platform.

## Installation

```sh
npm install @86d-app/tax
```

## Usage

```ts
import tax from "@86d-app/tax";

const module = tax({
  taxShipping: false,
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `taxShipping` | `boolean` | `false` | Whether to apply tax to shipping amounts |

## Features

- **Multi-jurisdiction tax rates** — country, state, city, and postal code specificity with automatic best-match scoring
- **Tax categories** — assign products to categories with different rates (e.g., clothing, food, digital)
- **Customer exemptions** — full or category-specific exemptions with optional expiration dates and tax ID/VAT storage
- **Compound rate stacking** — priority-based rate groups with compound and additive rate application
- **Tax-inclusive pricing** — extract tax from VAT/GST-inclusive prices instead of adding on top
- **Nexus management** — track physical, economic, and voluntary tax obligations by jurisdiction; tax only collected where nexus exists
- **Transaction audit log** — immutable record of every tax calculation for compliance and reporting
- **Compliance reporting** — aggregate tax collected by jurisdiction with date range filters

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/tax/rates?country=...&state=...` | Get applicable tax rates for a jurisdiction |

Cross-Module tax quotes use the `tax.quote` capability; there is no public `POST /tax/calculate` route.

## Admin Endpoints

### Tax Rates

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/tax/rates` | List all tax rates (filterable by country, state, enabled) |
| `POST` | `/admin/tax/rates/create` | Create a new tax rate |
| `GET` | `/admin/tax/rates/:id` | Get a tax rate by ID |
| `POST` | `/admin/tax/rates/:id/update` | Update a tax rate |
| `POST` | `/admin/tax/rates/:id/delete` | Delete a tax rate |

### Tax Categories

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/tax/categories` | List tax categories |
| `POST` | `/admin/tax/categories/create` | Create a tax category |
| `POST` | `/admin/tax/categories/:id/delete` | Delete a tax category |

### Tax Exemptions

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/tax/exemptions` | List tax exemptions for a customer |
| `POST` | `/admin/tax/exemptions/create` | Create a tax exemption |
| `POST` | `/admin/tax/exemptions/:id/delete` | Delete a tax exemption |

### Nexus Management

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/tax/nexus` | List nexus entries (filterable by country, enabled) |
| `POST` | `/admin/tax/nexus/create` | Register nexus in a jurisdiction |
| `POST` | `/admin/tax/nexus/:id/delete` | Remove a nexus entry |

### Transaction Audit & Reporting

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/tax/transactions` | List tax transactions (filterable by country, state, date range) |
| `POST` | `/admin/tax/transactions/:id/link` | Link a transaction to an order |
| `GET` | `/admin/tax/report` | Get aggregated tax report by jurisdiction |

## Controller API

```ts
interface TaxController {
  // Tax Rates
  createRate(params: CreateTaxRateParams): Promise<TaxRate>;
  getRate(id: string): Promise<TaxRate | null>;
  listRates(params?: { country?; state?; enabled?; take?; skip? }): Promise<TaxRate[]>;
  updateRate(id: string, params: UpdateTaxRateParams): Promise<TaxRate | null>;
  deleteRate(id: string): Promise<boolean>;

  // Tax Categories
  createCategory(params: { name: string; description?: string }): Promise<TaxCategory>;
  getCategory(id: string): Promise<TaxCategory | null>;
  listCategories(): Promise<TaxCategory[]>;
  deleteCategory(id: string): Promise<boolean>;

  // Tax Exemptions
  createExemption(params: CreateTaxExemptionParams): Promise<TaxExemption>;
  getExemption(id: string): Promise<TaxExemption | null>;
  listExemptions(customerId: string): Promise<TaxExemption[]>;
  deleteExemption(id: string): Promise<boolean>;

  // Tax Calculation
  calculate(params: {
    address: TaxAddress;
    lineItems: TaxLineItem[];
    shippingAmount?: number;
    customerId?: string;
  }): Promise<TaxCalculation>;
  getRatesForAddress(address: TaxAddress): Promise<TaxRate[]>;

  // Nexus Management
  createNexus(params: CreateTaxNexusParams): Promise<TaxNexus>;
  getNexus(id: string): Promise<TaxNexus | null>;
  listNexus(params?: { country?; enabled? }): Promise<TaxNexus[]>;
  deleteNexus(id: string): Promise<boolean>;
  hasNexus(address: TaxAddress): Promise<boolean>;

  // Transaction Logging
  logTransaction(params: { orderId?; customerId?; address; calculation; subtotal; shippingAmount }): Promise<TaxTransaction>;
  listTransactions(params?: TaxReportParams): Promise<TaxTransaction[]>;
  linkTransactionToOrder(transactionId: string, orderId: string): Promise<TaxTransaction | null>;

  // Reporting
  getReport(params?: TaxReportParams): Promise<TaxReportSummary[]>;
}
```

## Types

```ts
type TaxRateType = "percentage" | "fixed";
type TaxExemptionType = "full" | "category";
type TaxNexusType = "physical" | "economic" | "voluntary";

interface TaxAddress {
  country: string;
  state: string;
  city?: string;
  postalCode?: string;
}

interface TaxCalculation {
  totalTax: number;
  shippingTax: number;
  lines: TaxLineResult[];
  effectiveRate: number;
  inclusive: boolean;
  jurisdiction: { country: string; state: string; city: string };
}

interface TaxLineResult {
  productId: string;
  taxableAmount: number;
  taxAmount: number;
  rate: number;
  rateNames: string[];
}

interface TaxNexus {
  id: string;
  country: string;
  state: string;
  type: TaxNexusType;
  enabled: boolean;
  notes?: string;
  createdAt: Date;
}

interface TaxTransaction {
  id: string;
  orderId?: string;
  customerId?: string;
  country: string;
  state: string;
  city?: string;
  postalCode?: string;
  subtotal: number;
  shippingAmount: number;
  totalTax: number;
  shippingTax: number;
  effectiveRate: number;
  inclusive: boolean;
  exempt: boolean;
  lineDetails: TaxLineResult[];
  rateNames: string[];
  createdAt: Date;
}

interface TaxReportSummary {
  jurisdiction: { country: string; state: string };
  totalTax: number;
  totalShippingTax: number;
  totalSubtotal: number;
  transactionCount: number;
  effectiveRate: number;
}
```

## Store Components

### TaxEstimate

Displays applicable tax rates for a given address. Useful on product pages or cart summary.

| Prop | Type | Description |
|------|------|-------------|
| `country` | `string` | Country code |
| `state` | `string` | State/region |
| `city` | `string` | Optional city |
| `postalCode` | `string` | Optional postal code |

```mdx
<TaxEstimate country="US" state="CA" />
```

### TaxBreakdown

Displays a detailed tax breakdown for a completed calculation. Used in checkout summary and order receipts.

| Prop | Type | Description |
|------|------|-------------|
| `calculation` | `TaxCalculation` | Tax calculation result |

```mdx
<TaxBreakdown calculation={taxCalculation} />
```

## Notes

- Jurisdiction matching uses a scoring system: country=1, +state=10, +city=100, +postal=1000. Most specific match wins.
- Tax-inclusive pricing extracts tax from the price (`tax = price - price/(1+rate)`) — used for VAT/GST regions.
- When nexus records exist, the calculation engine only applies tax in jurisdictions where the store has nexus. When no nexus records exist, enforcement is off.
- Transaction logging creates an immutable audit trail. Transactions can be linked to orders after checkout.
- Reports aggregate by country + state, sorted by highest tax collected.
