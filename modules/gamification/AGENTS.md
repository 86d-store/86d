# Gamification Module

Spin-to-win, scratch-off, and slot-machine games with prize management and play-rate limiting.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts          Factory: gamification(options?) => Module + admin nav (Marketing)
  schema.ts         Zod models: game, prize, play
  service.ts        GamificationController interface
  service-impl.ts   GamificationController implementation
  store/endpoints/  get-game, play-game, can-play, redeem-prize
  admin/endpoints/  CRUD games, CRUD prizes, play-history, game-stats
  __tests__/        controllers (57), endpoint-security (15), events (11)
```

## Options

```ts
interface GamificationOptions extends ModuleConfig {
  defaultGameType?: string;    // default: "wheel"
  requireEmail?: string;       // default: "true"
  maxPlaysPerDay?: string;     // default: "1"
  cooldownMinutes?: string;    // default: "1440"
}
```

## Data models

- **Game** — id, name, description, type (wheel|scratch|slot), isActive, requireEmail, requireNewsletterOptIn, maxPlaysPerUser, cooldownMinutes, totalPlays, totalWins, startDate, endDate, settings, timestamps
- **Prize** — id, gameId, name, description, type (discount-percent|discount-fixed|free-shipping|free-product|custom), value, probability, maxWins, currentWins, discountCode, productId, isActive, createdAt
- **Play** — id, gameId, email, customerId, result (win|lose), prizeId, prizeName, prizeValue, isRedeemed, redeemedAt, ipAddress, userAgent, createdAt

## Patterns

- Prize selection uses cumulative probability weights (0-100 scale); roll < cumulative selects prize
- Play enforcement: checks isActive, date range, email requirement, max plays per user, cooldown period
- Identifier matching for rate-limiting uses email OR customerId OR ipAddress (any match counts)
- Events: game.played, game.won, game.lost, prize.redeemed, game.created, game.updated, game.deleted
- Exports: gameType, gameIsActive
