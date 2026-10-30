# Collect the installed CS5 loader facts without changing the TV

This tool addresses the difference between a software number and the installed loader. The [CS5 research](research/cs5-build-3706.md) concerns **OLED65CS5VA**, **webOS26 / 11.2.0-3706**, Israel. The supplied version evidence did not show the separate Software Version field. No serial, MAC or DRM identifier is needed.

## From the owner's paired TV

Follow [INSTALL.md](INSTALL.md) for Developer Mode pairing and `npm ci` first. From the repository directory on the owner's computer, with the TV paired under the alias `friend-tv`, run:

```sh
npm run inspect:loader -- --device friend-tv
```

The default CLI location is `./node_modules/.bin`, installed by `npm ci`. Reports are saved to timestamped files under ignored `.local/reports/`. The direct equivalent is `python3 -I scripts/collect_loader_facts.py --device friend-tv`. If running from another directory, add `--cli-dir` with the local absolute path to the repository's `node_modules/.bin` directory. To select a report filename, add `--output .local/reports/cs5-loader-facts.json`; the file must not already exist.

The script executes one ordinary developer SSH command. It reads five fixed files: the service loader, bootstrap parser, shared path checker, voiceweb manifest and release text. It returns hashes, sizes, presence markers and the release string. It never invokes the trusted app, `jsserver/run`, a privilege payload, profile rescan, package installation, setting change or power command. It writes the private report on the computer with mode 0600; the TV receives no file writes from the collector.

Report labels are deliberately limited:

- `older-parser-route-candidate-unverified`: recognizable old loader markers and a readable voiceweb manifest. This is a candidate for a separately reviewed one-shot probe, not proof of root or Home compatibility.
- `known-path-parser-route-has-final-path-guards`: final-path checks from the newer patch are visible. The older path-parser method should not be assumed to work.
- `insufficient-evidence`: information is missing or not recognized. A missing file inside the developer jail does not establish absence on the real root filesystem.

These are source-string fingerprints, not a full program proof. An altered/minified loader can require manual review. The collector always reports `privilegeVerified: false` and `readyForApply: false`. A successful read by the `prisoner` account does not elevate that account.

Send the JSON after reviewing it for private details. Also obtain the ordinary model/software/SDK report:

```sh
npm run inspect:tv -- --device friend-tv
```

No passphrase, SSH key, IP address, serial number or complete device screenshot is needed in a public issue. Keep original screenshots private because they contain identifiers unrelated to this research.

## Against local extracted firmware

```sh
python3 -I scripts/collect_loader_facts.py --from-root /path/to/extracted-root --output .local/reports/loader-facts.json
```

This mode contacts no device and reads only the extracted image. The included local research used this mode against actual G6 43.21.79, CS5-family 43.21.96, and CS5/C5 global 43.21.77 / 11.2.0-3706 extracts. The last of these matches the build photographed on the friend's TV. Neither these reads nor an offline parser simulation demonstrate privileged execution on that TV.
