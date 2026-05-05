## Android App Migration Workspace

This folder is the target home for the Android client after extraction from `apps/web/android`.

### Planned contents
- Native Android project files (`app`, Gradle wrappers, settings)
- Android runtime config wiring for:
  - `SERVER_BASE_URL`
  - `WALLETCONNECT_PROJECT_ID`
  - `SEPOLIA_CHAIN_ID`
  - `SEPOLIA_RPC_URL`

### Current status
- Migration started.
- Existing source Android project remains in `apps/web/android` until extraction is finalized.
