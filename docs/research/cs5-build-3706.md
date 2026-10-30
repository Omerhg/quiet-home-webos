# Temporary privileged access for the Israeli CS5: local research

Research date: 2026-10-30. Target family supplied by its owner: **OLED65CS5VA**, Israel, photographed **webOS26 / 11.2.0-3706**. Unit identifiers and original screenshots are excluded from this public report.

## Result

**The existing bounded, one-time voiceweb → jsserver parser route is a strong candidate for this photographed build.** Six relevant files in the global CS5/C5 **11.2.0-3706** firmware are byte-for-byte identical to the corresponding files in the G6 **43.21.79 / 11.2.0-3512** firmware, where the project previously obtained temporary UID/EUID 0. An offline test of the extracted bootstrap parser also reaches the staged-module callback on build 3706.

This establishes a concrete candidate rather than a need to invent or guess a different argument sequence. It does **not** establish root on the friend's TV. Its actual file fingerprints, privileged service access, UID/EUID and native Home baseline still need readback on that device. No TV was contacted or modified during this research.

**The current CS5-family download, 43.21.96 / 11.2.0-3711, is different:** its base root filesystem has no voiceweb application directory, and its bootstrap, main loader and fork-server paths check the final service directory. The same parser route is blocked in the offline test for that build. Changing an SDK number or choosing another trusted app would not remove those final-path checks. No alternative complete temporary-access method was established for 3711 in this research.

## Resolve the version distinction

The owner reported Software Version **43.21.79**. The supplied TV Information photo confirms **11.2.0-3706**, but does not display the separate Software Version field. Public CS5/C5 global firmware metadata associates build 3706 with **43.21.77**. I did not locate a CS5/O22N3 43.21.79 image in the searched catalog. That is a gap in available evidence, not proof that the reported software number is impossible.

Use the photographed build and installed-file fingerprints to select the research candidate; do not substitute the G6 image merely because a software number matches. The full screenshot identifiers beyond model/build were excluded: serial, MAC addresses, ESN, VSN and DRM identifiers are not needed.

| Image | Hardware family / OTA ID | Release | Role in this research |
| --- | --- | --- | --- |
| Global CS5/C5 43.21.77 | O22N3 / HE_DTV_W25G_AFABATAA | 11.2.0-3706 | Matches the photographed SDK build; critical code matches known-working G6 code. |
| Global CS5/C5 43.21.96 | O22N3 / HE_DTV_W25G_AFABATAA | 11.2.0-3711 | Current representative CS5-family download; older route is blocked. |
| Previously inspected G6 43.21.79 | O26 / HE_DTV_W26O_AFABATAA | 11.2.0-3512 | Working reference for temporary execution, not a CS5 firmware image. |

The historical global package is a representative image from the same family and build. Its original distribution was not the friend's exact regional support download. Installed file readback remains the final way to connect this image to the actual TV. None of these images should be installed as part of the research procedure.

## Download and verification evidence

LG Israel's [CS5 product page](https://www.lg.com/il/tv/lg-oled65cs5va) identifies the OLED65CS5VA family. The live [Israeli support page](https://www.lg.com/il/support/product/lg-OLED65CS5VA.AMFE), fetched locally on the research date, listed **43.21.96**, dated **2026-10-29**, with OLED55CS5VA and OLED65CS5VA in its applicability list. A search-engine cache still showed an older version; the saved live HTML was used for the download decision.

The current 43.21.96 package was downloaded directly from LG's linked host. For the historical 3706 comparison, the [archive metadata](https://tv.slada.sk/processed_fw.json) supplied the older LG package identity and hashes. The recovered official older links returned non-firmware error pages, which were rejected. The historical package was then downloaded from the archive mirror, using no more than two concurrent connections, and checked against the recorded hash. Its EPK was independently signature-checked with OpenLGTV's extractor.

| Artifact | Bytes | SHA-256 |
| --- | --- | --- |
| 43.21.77 historical ZIP | 1,886,840,171 | `e9b800a8474f66d82b2929f532dd3996c5e2476d422044267e3826514f0b10a7` |
| 43.21.77 EPK | 1,904,391,573 | `aecb45c2c3762f8bb8ff039902713ff9fc87f65b13e04741ed64112e2cfd2c31` |
| 43.21.96 official ZIP | 1,885,904,262 | `d0d3c603cabe5faa1768f644605283fdb131c035f7d6f3af3fa7cc4d7d04a73f` |
| 43.21.96 EPK | 1,904,870,805 | `a72caafdb1b92f817b3c430a5a9383dbe8f663daffc3af8a6c848bbb70d35c1c` |

Both EPKs were extracted with signature checking enabled using [OpenLGTV epk2extract](https://github.com/openlgtv/epk2extract), locally built at commit `a0ccd8a4b4f48d05675a4cddd233f8780ee36767`. The extraction logs completed with 315 and 316 successful verification records respectively. The historical ZIP uses Deflate64; Info-ZIP's supported decoder was used for its EPK. No firmware was repacked or flashed.

Selected files were extracted from the root filesystem inside `super.pak` at offset 1,048,576. The full release text in each image matched the version shown in the table.

## Why the matching build is a useful candidate

These six files from CS5/C5 build 3706 are identical to the previously analyzed, known-working G6 reference:

- `/usr/palm/nodejs/unified_service_server.js`
- `/usr/palm/services/jsservicelauncher/bootstrap.js`
- `/usr/palm/applications/com.webos.app.voiceweb/appinfo.json`
- `/usr/palm/applications/com.webos.app.voiceweb/index.html`
- `/usr/bin/run-js-service`
- `/usr/bin/run-unified-service-server`

The loader verifies a ROM service path from the initial argument list, while the bootstrap selects the module directory from the arguments after the separator. Those two decisions can refer to different directories in the older code. The project's existing helper uses this discrepancy to execute only its staged, bounded profile operation. It does not invoke an upstream persistence installer.

The full six-file comparison is in [the firmware comparison data](cs5-file-comparison.json). The important source fingerprints are:

| File | Build 3706 / G6 reference SHA-256 |
| --- | --- |
| `unified_service_server.js` | `46216ccc3e2f775308d68f93d6ea647b43f53481a40d9b1ba6ea9e1f3bffcac2` |
| `bootstrap.js` | `777a595a373c596092a5334a4c1412f19407ef9a16a0dcf679a5b54148b6602f` |
| voiceweb `appinfo.json` | `3b9846d079ca99d3163188bb3838e7ade71dffdda1f377280764b0f73477d248` |

Shared code and a matching build are stronger evidence than a similar marketing name. They still do not establish identical runtime service permissions, jail policy, service state or effective UID on the physical CS5.

## What changes in 3711

The extracted current image moves path validation to a shared canonical-path checker. Bootstrap checks the selected directory before changing into it, and the main loader checks that same final directory before requiring a module. Fork-server launch paths also use the checker. The preliminary argument-index comparison is no longer the decisive check. The filesystem listing also has no voiceweb application directory.

The original two shell wrappers remain identical across the images; the material fixes are in the JavaScript loader/parser and the entry app. Therefore adjusting only wrapper flags or the reported SDK is not a port of the old method.

The bootstrap still performs its PID-only cgroup write before checking the directory. This is an observation requiring separate analysis, not a complete root method: it does not itself supply arbitrary JavaScript execution or the JSON contents needed for a Home profile. No attempt was made to turn that observation into another device modification.

## Offline validation

The [offline comparison harness](../../scripts/research/offline-loader-check.mjs) loads the actual extracted bootstrap sources with in-memory filesystem/process dependencies. It runs six cases: staged and ROM directories for G6 3512, CS5-family 3711, and CS5/C5 3706. It performs no network calls and loads no service module. Filesystem operations requested by the firmware code are recorded as virtual events. Proprietary firmware extracts and the local extraction tree are not bundled with this repository.

To reproduce from your own verified local extracts:

```sh
node scripts/research/offline-loader-check.mjs \
  --reference-root /path/to/g6-3512-root \
  --candidate-root /path/to/cs5-3706-root \
  --patched-root /path/to/cs5-3711-root
```

Each root must contain its extracted `/usr/palm/services/jsservicelauncher/` files. The harness checks the source hashes against the exact researched revisions before evaluation and refuses other sources. All firmware dependencies are simulated; this is not a general sandbox for arbitrary JavaScript or a TV exploit launcher. The new output file is saved under ignored `.local/reports/`, with owner-only permissions and overwrite refusal. It can also be selected with `--output`.

The 3512 and 3706 parsers reach the staged-directory callback; the 3711 parser rejects the staged directory before changing into it or reaching that callback. All three accept the simulated trusted ROM directory. These are parser results, **not privileged execution**. The sanitized [offline observations](cs5-parser-observations.json) record the results; they contain no live device readouts.

The read-only collector was exercised locally against the three image roots; missing-file handling, absence of writes to the inspected root, and 0600 report permissions were also checked. Its source-string classification is a diagnostic aid, not a proof of vulnerability or compatibility.

## Concrete next step on the friend's TV

1. Use the [read-only collector instructions](../LOADER-FACTS.md) and the repository's ordinary `inspect:tv` command to verify the installed build and loader fingerprints. Files hidden by the developer jail count as unknown, not as a successful match or evidence of a patch.
2. If the installed files match the 3706 candidate, review the existing [native Home helper and payload](https://github.com/Omerhg/quiet-home-webos/blob/main/docs/NATIVE-HOME.md). Ensure the ordinary **public** launcher `com.quiet.home` is installed if using its full baseline probe; do not mix it with the original owner's personal app ID.
3. With the TV owner's authorization for temporary privileged execution, run the existing bounded probe from their computer:

```sh
node scripts/native-home.mjs --device friend-tv --pc-ip YOUR_COMPUTER_LAN_IP --mode probe
```

`probe` stages a one-shot module, opens its local setup page inside the trusted app, reads UID/EUID and the required Home baseline, and records a result. It creates no Home override. A result containing **`uid: 0`, `euid: 0`** confirms temporary privileged execution; **`status: probe-passed`** additionally confirms that the current payload accepted the native Home baseline. A later baseline error with UID/EUID 0 confirms execution but does not authorize bypassing that failed baseline.

This is an explicit privileged experiment, not the ordinary read-only inspection. It creates temporary staging files and changes the foreground to the setup app; it does not flash firmware, install a root listener, add persistence, change Developer Mode renewal or run a Home watcher. Completed staging is cleaned up, and its private report is saved on the setup computer. An unclear attempt is retained for diagnosis. Existing logs are not erased, and an OS restart does not patch the underlying firmware issue.

Only consider `apply` after the actual probe and rollback plan have been reviewed. The native Home profile link is a separate modification with its own readback and restoration requirements. No apply, restore, root probe or pairing was performed by this local research session.

## Files and sharing

The local research directory retains the packages, hashes, extraction logs, selected proprietary files, parser simulation, and comparison JSON. This public repository includes only the original explanation, the original [read-only collector](../../scripts/collect_loader_facts.py), its instructions, and sanitized firmware-comparison/parser-observation JSON. These observations came from offline image analysis, not a live TV inventory. No proprietary firmware code, credentials, original screenshots, unit identifiers or personalized app packages are published.
