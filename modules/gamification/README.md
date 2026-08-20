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

# Gamification Module

📚 **Documentation:** [86d.app/docs/modules/gamification](https://86d.app/docs/modules/gamification)

Add interactive games (spin-to-win wheels, scratch-off cards, slot machines) to your storefront with configurable prizes, play-rate limiting, and analytics.

## Installation

```sh
npm install @86d-app/gamification
```

## Usage

```ts
import gamification from "@86d-app/gamification";

const module = gamification({
  defaultGameType: "wheel",
  requireEmail: "true",
  maxPlaysPerDay: "1",
  cooldownMinutes: "1440",
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultGameType` | `string` | `"wheel"` | Default game type (wheel, scratch, slot) |
| `requireEmail` | `string` | `"true"` | Require email to play |
| `maxPlaysPerDay` | `string` | `"1"` | Max plays per user per day |
| `cooldownMinutes` | `string` | `"1440"` | Cooldown between plays in minutes |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/gamification/games/:id` | Get game details |
| POST | `/gamification/games/:id/play` | Play a game |
| GET | `/gamification/games/:id/can-play` | Check if user can play |
| POST | `/gamification/plays/:id/redeem` | Redeem a won prize |

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/gamification/games` | List all games |
| POST | `/admin/gamification/games/create` | Create a game |
| GET | `/admin/gamification/games/:id` | Get game details |
| POST | `/admin/gamification/games/:id/update` | Update a game |
| POST | `/admin/gamification/games/:id/delete` | Delete a game |
| GET | `/admin/gamification/games/:id/prizes` | List prizes for a game |
| POST | `/admin/gamification/games/:id/prizes/add` | Add a prize to a game |
| POST | `/admin/gamification/prizes/:id/update` | Update a prize |
| POST | `/admin/gamification/prizes/:id/delete` | Delete a prize |
| GET | `/admin/gamification/games/:id/plays` | Play history for a game |
| GET | `/admin/gamification/games/:id/stats` | Game statistics |

## Controller API

```ts
interface GamificationController extends ModuleController {
  createGame(params: { name: string; type?: GameType; ... }): Promise<Game>;
  getGame(id: string): Promise<Game | null>;
  updateGame(id: string, params: Partial<Game>): Promise<Game | null>;
  deleteGame(id: string): Promise<boolean>;
  listGames(params?: { type?: GameType; isActive?: boolean; ... }): Promise<Game[]>;
  addPrize(gameId: string, params: { name: string; value: string; probability: number; ... }): Promise<Prize>;
  updatePrize(id: string, params: Partial<Prize>): Promise<Prize | null>;
  removePrize(id: string): Promise<boolean>;
  listPrizes(gameId: string): Promise<Prize[]>;
  play(gameId: string, params: { email?: string; ... }): Promise<Play>;
  redeemPrize(playId: string): Promise<Play | null>;
  getPlayHistory(params?: { gameId?: string; email?: string; ... }): Promise<Play[]>;
  getGameStats(gameId: string): Promise<GameStats>;
  canPlay(gameId: string, params: { email?: string; ... }): Promise<CanPlayResult>;
}
```

## Types

- **GameType** — `"wheel" | "scratch" | "slot"`
- **PrizeType** — `"discount-percent" | "discount-fixed" | "free-shipping" | "free-product" | "custom"`
- **Game** — Game configuration with play limits, date range, and settings
- **Prize** — Prize with probability weight, max wins tracking, and optional discount code
- **Play** — Play result record (win/lose) with optional prize details
- **GameStats** — Aggregate stats with win rate and prize breakdown
- **CanPlayResult** — Eligibility check with reason and next available play time

## Notes

- Prize probability uses a cumulative weight system (0-100 scale). If total weights sum to less than 100, some plays result in a loss.
- Play rate limiting checks email, customerId, or ipAddress -- any single match counts against the limit.
- Games support optional start/end dates for time-limited campaigns.
