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

# 86d CLI

CLI for 86d — modular, open-source commerce platform.

## Installation

```sh
npm install -g 86d
```

## Commands

| Command | Description |
|---|---|
| `86d dev` | Start the store development server |
| `86d init [--yes\|-y]` | Configure a local store (env, deps, migrate, seed) |
| `86d status` | Show project health and configuration |
| `86d module create <name>` | Scaffold a new module |
| `86d module list` | List all modules |
| `86d module info <name>` | Show module details |
| `86d module enable <name>` | Enable a module in the active template |
| `86d module disable <name>` | Disable a module in the active template |
| `86d template create <name>` | Scaffold a new template from brisa |
| `86d template list` | List all templates |
| `86d generate` | Run all code generation |
| `86d generate modules` | Generate module imports and API router |
| `86d generate components` | Generate component documentation |

## Usage

```sh
# Initialize a new store (interactive: prompts for migrate + seed if DATABASE_URL is set)
86d init

# Initialize non-interactively — auto-confirms all prompts (useful for CI/scripts)
86d init --yes

# Check project health
86d status

# Start development
86d dev

# Scaffold and enable a custom module
86d module create loyalty-points
86d module enable loyalty-points

# Regenerate after changes
86d generate
```
