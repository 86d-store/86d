<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">Dynamic Commerce</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use.

# Tipping Module

📚 **Documentation:** [86d.app/docs/modules/tipping](https://86d.app/docs/modules/tipping)

Add tipping to orders with preset percentages, custom amounts, tip splitting between recipients, payout management, and configurable settings.

## Installation

```sh
npm install @86d-app/tipping
```

## Usage

```ts
import tipping from "@86d-app/tipping";

const module = tipping({
  defaultPercents: "15,18,20,25",
  allowCustomAmount: "true",
  maxTipPercent: "100",
  enableTipSplitting: "false",
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultPercents` | `string` | `"15,18,20,25"` | Comma-separated preset tip percentages |
| `allowCustomAmount` | `string` | `"true"` | Allow custom tip amounts |
| `maxTipPercent` | `string` | `"100"` | Maximum tip percentage |
| `enableTipSplitting` | `string` | `"false"` | Enable splitting tips between recipients |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/tipping/tips` | Add a tip to an order |
| POST | `/tipping/tips/:id` | Update a tip |
| POST | `/tipping/tips/:id/delete` | Remove a tip |
| GET | `/tipping/tips/order/:orderId` | Get all tips for an order |
| GET | `/tipping/settings` | Get public tip settings |

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/tipping/tips` | List all tips |
| GET | `/admin/tipping/tips/:id` | Get tip details |
| POST | `/admin/tipping/tips/:id/split` | Split a tip between recipients |
| POST | `/admin/tipping/payouts` | Create a payout |
| GET | `/admin/tipping/payouts/list` | List payouts |
| GET | `/admin/tipping/stats` | Tip statistics |
| GET | `/admin/tipping/settings` | Get tip settings |
| POST | `/admin/tipping/settings/update` | Update tip settings |

## Controller API

```ts
interface TippingController extends ModuleController {
  addTip(params: AddTipParams): Promise<Tip>;
  updateTip(id: string, params: UpdateTipParams): Promise<Tip | null>;
  removeTip(id: string): Promise<boolean>;
  getTip(id: string): Promise<Tip | null>;
  listTips(params?: { orderId?: string; recipientId?: string; status?: string; ... }): Promise<Tip[]>;
  splitTip(id: string, splits: SplitEntry[]): Promise<Tip[]>;
  getTipTotal(orderId: string): Promise<number>;
  createPayout(params: CreatePayoutParams): Promise<TipPayout>;
  getPayout(id: string): Promise<TipPayout | null>;
  listPayouts(params?: { recipientId?: string; status?: string; ... }): Promise<TipPayout[]>;
  getSettings(): Promise<TipSettings>;
  updateSettings(params: Partial<TipSettings>): Promise<TipSettings>;
  getTipStats(params?: { startDate?: Date; endDate?: Date }): Promise<TipStats>;
}
```

## Types

- **Tip** — Individual tip on an order with amount, type (preset/custom), recipient, and status
- **TipPayout** — Aggregated payout to a recipient for a time period
- **TipSettings** — Global configuration for preset percentages, limits, and splitting
- **TipStats** — Aggregate statistics including totals, averages, and payout summaries
- **AddTipParams** — Parameters for adding a tip (orderId, amount, type, recipientType)
- **SplitEntry** — Split destination with recipientType, recipientId, and amount
- **CreatePayoutParams** — Parameters for creating a payout (recipientId, amount, period range)

## Notes

- `splitTip` deletes the original tip and creates new tips for each split entry. New tips reference the original via `metadata.splitFrom`.
- `getTipTotal` sums only non-refunded tips for an order.
- Settings are auto-created with defaults (15/18/20/25%, max 100%, max $1000) on first access if not yet configured.
- The controller does not use the event emitter directly -- event emission is declared in the module but wired at the endpoint level.
