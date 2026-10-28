# Contributing

Suggest changes with a pull request from your fork. Explain the behavior change, relevant tests and any device/firmware limits. Use synthetic fixtures and remove secrets before attaching logs or screenshots.

The maintainer must approve changes before they are merged. Direct pushes to this public repository, including pushes made by an assistant or automation, need the owner's explicit approval. A development request is not approval to publish it. No auto-merge or automatic release publication is configured.

Keep personalized configuration and packages outside Git. Run the checks in the README and inspect the staged diff. Do not include account tokens, live capability/webhook URLs, pairing keys, developer passphrases, device reports, firmware images or private browser links. Follow [SECURITY.md](SECURITY.md) for sensitive reports.

The public app IDs and one-shot native Home setup must stay consistent. Changes to privileged setup, rollback, remote restoration or capability boundaries need tests that verify both the intended change and preservation of unrelated state. Report on-device evidence separately from browser/service simulations.
