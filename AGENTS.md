# Repository instructions

## Publication approval

The owner explicitly requires approval before **every push to this public repository**, including a new branch, pull-request branch, initial push, tag, force-push or release publication. Preparing local code, commits, tests and a reviewable diff is allowed. A request to make a change is not permission to publish it. Finish the work and scans, show the concrete result, then ask for explicit approval identifying the commit/branch to publish. Do not bypass a rejected or pending approval.

Use pull requests to suggest changes. Do not merge or enable auto-merge without the owner's explicit approval. Never weaken branch rules, review requirements or CODEOWNERS to publish a change.

## Privacy

Never commit `.local/`, `.build/`, `dist/`, personal packages, credentials, real HA capabilities/webhooks, pairing files, device reports or private network inventories. Keep tracked connection files empty. Build personalized versions only into ignored output. Inspect the staged diff, run `npm run scan`, and run Gitleaks before proposing any public push. Report finding paths/rules without printing secret values.

## Verification

Run checks appropriate to a change. The key suites are `npm run check`, `npm run test:policy`, `npm run test:ha`, `python3 -I tests/test_setup_tools.py` and `npm test`. Test code must use synthetic fixtures; it must never invoke live TV/HA actions. Do not modify a TV or HA instance simply to improve this public source unless its owner separately requests it.

Document firmware-specific limits honestly. The ordinary launcher needs no root or firmware changes; native default-Home setup uses a bounded one-time privileged operation and leaves no persistent root service. Do not relabel that operation as having needed no privilege.
