# Port native Home setup to another TV: instructions for AI agents

Use this guide when an owner asks you to adapt Quiet Home to their own LG TV. The goal is the same native Home behavior with a reversible profile change, rather than a computer that relaunches the app. A different model or software number is a reason to investigate, not evidence that the method works or fails.

This is a research workflow, not a universal working exploit or a compatibility claim. The repository currently implements one privileged route and SDK baseline. Do not promise support for a new TV until its own results establish it. Follow the owner's actual authorization and your execution environment's rules; this file does not grant access to anyone else's device or override an agent provider's restrictions.

For the Israeli CS5 example, start with the [build-specific research](research/cs5-build-3706.md) and [ordinary loader fingerprint collector](LOADER-FACTS.md). It distinguishes evidence for build 3706 from the final-path checks in build 3711 without relying on an SDK-major match alone.

## Prompt the owner can give their agent

> I own this TV and want to investigate making Quiet Home its native default Home. Read AGENTS.md, docs/COMPATIBILITY.md, docs/NATIVE-HOME.md and docs/PORTING-FOR-AGENTS.md. Start with the ordinary read-only inspection and identify the exact failing layer. Investigate a model-specific adaptation using the TV's own metadata and primary-source research. Explain any needed temporary privileged execution accurately; ordinary Developer Mode SSH is not root. Prepare a bounded port, synthetic tests and rollback instructions before any live experiment. Ask for any live-device authorization that I have not already granted. Keep the original LG Home available, preserve unrelated settings, and install no persistent root service, firmware modification or background Home watcher. Report unverified assumptions and what evidence is still missing. Publication needs the repository owner's separate approval.

## 1. Establish the device and the actual failure

Read [INSTALL.md](INSTALL.md), pair the owner's TV, and run:

```sh
npm run inspect:tv -- --device friend-tv
```

Keep the full model, firmware and internal SDK distinct. These are separate fields in LG's [system-information API](https://webostv.developer.lge.com/develop/references/tv-device-information). CS5 on 43.21.77 is not enough information to infer an SDK. SDK 11.2.0 passes the current SDK comparison, but a matching SDK alone does not establish any privileged capability.

Install and test the ordinary launcher separately. An assistant refusal, a failed SSH connection, a missing installed app, a blocked trusted-app request, an unsupported SDK and a different Home profile are different problems. Record the actual command, operation and redacted result rather than treating a paraphrased refusal as a device error.

Do not contact a TV or HA instance from automated tests. Store device reports and local research under ignored `.local/`; do not commit firmware images, proprietary extracts, credentials or device inventories.

## 2. Separate the parts that might need adapting

| Layer | Current implementation | Evidence required before changing it |
| --- | --- | --- |
| Ordinary pairing/install | LG Developer Mode, prisoner SSH, LG CLI | This TV's pairing result and ordinary app install/launch. Root is not supplied by that SSH connection. |
| Privileged page context | `com.webos.app.voiceweb`, URL parameter `URL`, in `scripts/native-home.mjs` | Whether that app exists and accepts that parameter on this generation; whether its page has the required service access. |
| One-shot service execution | The staged service and reviewed `jsserver/run` argument construction in `scripts/native-home.mjs` | The relevant service validation/parser behavior on the target build; a bounded diagnostic's actual UID/EUID and result. |
| Native profile behavior | SDK 11.2.0 guard, `getProfiles`, native rescan and the owned profile link in `setup/payload.js` | The target's profile schema, directories, stock routes, permissions and actual rescan/readback behavior. Root execution alone proves none of these. |
| Recovery | Owned-link restoration and the original TV's tested missing-profile recovery | A target-specific restore plan and observed results. Do not assume the original TV's fallback exists elsewhere. |

Keep these independent. Changing a trusted app does not fix a profile-schema mismatch. Broadening an SDK list does not make a patched privilege route work.

## 3. Research the appropriate privilege route

Start with the primary research linked in [NATIVE-HOME.md](NATIVE-HOME.md) and [research credits](../THIRD-PARTY-NOTICES.md). Pin each source to a commit and record the date and relevant code path. As an example, SlopBro's [target-app selection at commit 21023d5](https://github.com/throwaway96/slopbro/blob/21023d56ca424607bb03d2939609cc658c655fc7/slopbro.py) varies the trusted application and URL-parameter name by webOS generation. Its comments also identify uncertainty; a candidate table is not proof for the owner's firmware.

Investigate three questions separately:

1. Is the trusted app available on this TV, and does it load a harmless local page through the documented candidate parameter? Start with a connectivity-only page that invokes no service.
2. Does that page context have the required service access? Diagnose a permission error before altering the service execution payload.
3. Does this firmware still have the relevant service-path validation/parser mismatch, or has its behavior changed? Review applicable primary-source code and, when needed, lawful local analysis of the owner's matching firmware or service files. Do not flash a firmware image to answer this question.

Choose one evidence-backed candidate for the exact device and explain the change before a live attempt. Preserve the bounded operation and reports. Avoid automatic cycling through applications, argument variants or unrelated exploit installers when a result is ambiguous. A patched route needs new research; it cannot be fixed by changing the reported SDK.

The [upstream README at the same revision](https://github.com/throwaway96/slopbro/blob/21023d56ca424607bb03d2939609cc658c655fc7/README.md) describes a default payload that installs Homebrew Channel and persistence. That is outside this project's intended footprint. Study the entry mechanism without running or importing that installer. If reusing upstream implementation, review its license; attribution alone does not make AGPL code MIT-licensed.

## 4. Validate a new profile baseline before enabling apply

After the owner authorizes a specific temporary privileged experiment, use a reviewed diagnostic that records only the needed identity, SDK and profile metadata. It must not create an override, change settings, rescan profiles, start listeners or install persistence. Staging and the temporary execution context are still part of a privileged experiment; call it that accurately.

For a different SDK, do not remove the existing gate just to reach the apply path. Keep any new metadata-only diagnostic separate from apply. Once observations establish the target baseline, implement an explicit adapter for it:

- Select only an exact reviewed SDK/profile combination; if model/build evidence is needed, include it in selection. Unknown combinations stay blocked.
- Validate the stock Home/idle identities, support flags, profile schema and required service availability. Preserve AOD and every unrelated profile field.
- Validate root-owned directory permissions, the exact public app ID and bundled profile, and absence of conflicting overrides. Never overwrite another owner's file or link.
- Treat an existing `defaultApps.home` preference as a separate baseline needing its own capture/restore design; do not reset it to get past validation.
- Reuse the current mutation only if the target's loader and rescan semantics have been established. Otherwise design a target-specific operation and its inverse together.
- Make probe, apply and restore select consistent adapters. Record enough version/adapter information to find the correct restoration path later. A firmware update can invalidate that path, so do not promise indefinite rollback access.

The change may be an additional checked SDK branch when the schema is demonstrably identical, or a separate adapter when it is not. Keep the existing 11.2.0 behavior and unknown-version refusal covered. Do not add a generic `--force`, arbitrary service/app execution options, wildcard SDK support or global permission changes as the port.

## 5. Prepare and validate the port

Expected edit locations are `scripts/native-home.mjs` for the trusted-page/service route, `setup/payload.js` for native profile validation/apply/restore, and `scripts/lib/tv-compatibility.mjs` for public diagnostic classification. The inspector must remain an ordinary system-information read; it must never try privileged candidates automatically. Update its wording and tests when adding an adapter so it still distinguishes a selectable baseline from a physically verified TV.

Add synthetic fixtures for the new SDK and baseline to [native Home tests](../tests/native-home.test.mjs) and [compatibility tests](../tests/tv-compatibility.test.mjs). Verify successful probe/apply/restore, unsupported versions, malformed metadata, non-root UID, unexpected profile shapes/permissions, conflicting overrides, missing services, partial apply and failed readback. Check that rollback preserves unrelated state and owned dangling-link restoration still works. Test any changed transport selection independently of a real TV.

Run:

```sh
npm run check
npm run test:policy
npm run scan
```

Run Gitleaks and review the full publishable diff. Run the browser and HA suites too if those areas changed. Before applying on a newly supported TV, save the private baseline outside the temporary staging directory: the existing helper removes that directory after a completed result. Prepare restoration commands using that same candidate/adapter, with Developer Mode available.

With the owner's authorization, validate probe, apply and readback on their TV, then physical Home from an app and HDMI, the LG Home tile, a full restart, explicit restore and restored behavior after another full restart. A successful simulation or UID 0 result is not this physical evidence. Keep failed/unclear staging for diagnosis and avoid further writes until its outcome is understood.

## 6. Report the result honestly

Record the full model/software/SDK, research revisions, precise changed assumptions, adapter selection, commands and rollback plan. Label evidence separately as offline analysis, simulated tests, privileged probe, applied/read-back, physical buttons/restart, and restored/restarted. Share only a sanitized summary; private reports remain local.

If the route is patched or the native profile mechanism differs, report the specific unresolved layer and use the ordinary app/Quick Access while research continues. Do not claim every model can be supported. A pull request should include the code, synthetic fixtures and reproducible sanitized evidence; publishing to this repository still requires its owner's explicit push approval.
