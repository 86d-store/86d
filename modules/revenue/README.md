<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  The Modern Foundation for Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk.

# Revenue Module

📚 **Documentation:** [86d.app/docs/modules/revenue](https://86d.app/docs/modules/revenue)

Revenue and transaction reporting for the 86d commerce platform. Reads local Payment intents through the Payments capability, calculates volume, count, average value, status counts, and basic refund figures for a date range, and supports paginated transaction lists plus CSV export.

Experimental: this Module does not aggregate provider settlements, payouts, complete Order revenue, channels, or product performance. Output is a projection of Payment intent records, not a settlement or accounting ledger.

## Installation

```sh
npm install @86d-app/revenue
```

## Usage

```ts
import revenue from "@86d-app/revenue";

const module = revenue();
```

Optionally accepts Payments `paymentIntent` list capability; when absent, reporting surfaces fail closed or return empty projections per endpoint behavior.

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/revenue/stats` | Payment-intent statistics for a date range |
| `GET` | `/admin/revenue/transactions` | Paginated transaction ledger |
| `GET` | `/admin/revenue/export` | CSV export of filtered Payment intents |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/revenue/transactions` | List the authenticated Customer's Payment intent records |

## Pages

| Surface | Path | Component |
|---|---|---|
| Store | `/account/transactions` | `TransactionHistory` |
| Admin | `/admin/revenue` | `RevenueAdmin` (Finance group) |

## Component exports

| Export path | Description |
|---|---|
| `@86d-app/revenue/admin/components/revenue-admin` | Store Admin revenue UI |
| `@86d-app/revenue/components` | Storefront MDX components |
