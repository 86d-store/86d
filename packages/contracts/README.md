<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/icon" height="96" alt="86d" />
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

# `@86d-app/contracts`

Immutable, versioned Command and Change Set conformance for the Control Plane and Store Runtime.

## Entry points

| Export | Contents |
| --- | --- |
| `@86d-app/contracts/command` | Request/receipt schemas, actors, action levels, failures, workflows, grants, approvals, confirmations, audit, transitions, canonical digests |
| `@86d-app/contracts/change-set` | Change Set schemas and review-hash helpers |
| `@86d-app/contracts/conformance` | Artifact version, SHA-256 digest, compatibility matrix, fixtures, pin verification |

Private Command catalogs and plane-specific authorization stay outside this package. Raw tRPC is not a cross-plane or agent interface.

## Pinning

Consumers pin an exact package version and verify `CONFORMANCE_DIGEST` at build and startup via `assertConformancePin`. A mismatch fails closed as `contract_version_mismatch`.

Publication uses a signed `contracts-v{version}` tag, provenance-bearing npm release, and byte-equivalent GitHub `.tgz` fallback. Until that operator gate lands, local development may use a commit-pinned packed artifact; that path cannot satisfy clean-install or release evidence.

## Regeneration

```bash
bun run generate:conformance
```

Run twice and compare digests byte-for-byte before cutting a release.
