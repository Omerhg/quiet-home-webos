# Public/private boundary

The public export is assembled from an explicit allowlist of code, original icons, licensed photography/fonts, tests, examples and instructions. It starts a new Git history; it does not publish the original workspace or its history.

Not included:

- TV passphrases, SSH/private keys, pairing records, renewal tokens or account files.
- Home Assistant account tokens, live webhook/capability values, personal entity/device IDs or integration backups.
- Original LAN addresses, private hostnames/bookmarks, personal computer paths, logs or actual device inventories.
- Personalized IPKs, archives, build output, firmware images, downloaded system binaries or dependency directories.
- Photographic screenshots containing personal on-TV state. Test-generated screenshots are ignored.

Public examples use generic entity names. Browser fixtures use loopback endpoints and clearly synthetic strings; the pure address test uses a non-personal example address. App IDs, upstream asset hashes and credited photographer names are public metadata, not account secrets.

`app/*-config.js` are tracked empty defaults. `scripts/build.mjs` copies the source to `.build/app`, then applies optional `.local/config.json` values only there. Its CSP permits only the configured HA origin. A fresh checkout builds with HA disconnected. The public Mute/Home app IDs are generic and consistent across manifests, profile and setup scripts.

Before publication the complete staged source is checked with `npm run scan`, Gitleaks and an additional in-memory comparison against known private values from the original setup. Findings are reported by path/rule only; values are not printed. Images are included in the known-value comparison too. The complete initial Git history is scanned before push. A scan is evidence, not a mathematical guarantee; future changes need the same care.

`.gitignore` excludes `.local/`, `.build/`, `dist/`, credentials, environment files, reports and package artifacts. It is a safeguard, not a substitute for checking `git diff --cached` before sharing. Never force-add a personalized package or capability config.
