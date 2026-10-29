# A different TV or a refused default-Home step

## CS5 on software 43.21.77

A message from an assistant saying it will not run a privilege-escalation exploit is not an error returned by the TV. It also does not establish that the TV is incompatible. The ordinary app and privileged default-Home operation need separate compatibility checks.

The native payload does **not** compare a model name or software number. It checks internal **SDK 11.2.0**, then the protected stock Home/idle routes, settings, bundled app profile and directory/link ownership. Therefore **43.21.77 versus 43.21.79 alone does not trigger a refusal**. Equally, similar software numbers do not prove compatibility. The full CS5 model and SDK are needed; this project has no physical verification for that TV.

LG documents `modelName`, `firmwareVersion` and `sdkVersion` as separate [system-information fields](https://webostv.developer.lge.com/develop/references/tv-device-information). Read the SDK rather than inferring it from a firmware number or marketing name.

## Read-only check first

Pair Developer Mode following [INSTALL.md](INSTALL.md), then run:

```sh
npm run inspect:tv -- --device friend-tv
```

Equivalent entry point:

```sh
node scripts/native-home.mjs --device friend-tv --mode inspect
```

No computer IP is needed. This issues only LG CLI's `ares-device --device friend-tv --system-info`. It does not stage a payload, start a server, open an app, invoke the firmware vulnerability, change Home or write to the TV. It saves a filtered model/firmware/SDK report under ignored `.local/reports/`, with owner-only file permissions. Connection failures do not print raw CLI errors, addresses or credentials.

| Result | Meaning and next step |
| --- | --- |
| `sdk-matches-unverified` | SDK 11.2.0 matches the existing gate. This TV is still unverified. Review the separate [native setup](NATIVE-HOME.md); the privileged probe must still pass all baseline checks. Nothing is applied automatically. |
| `unsupported-sdk` | The native payload will refuse the reported SDK. Keep the guard. Use the ordinary launcher and a shortcut while a model-specific port is investigated. |
| `sdk-unknown` | Information was incomplete. Check Developer Mode pairing and user agreements locally; the script exits unsuccessfully and does not guess. |

Even the original G6 reference produces `readyForApply: false` from this check: public system information cannot verify protected profiles or whether temporary privileged execution will work. `inspect` is not a substitute for the native probe. Unlike `inspect`, **`probe`, `apply` and `restore` all invoke temporary administrator execution through a firmware vulnerability**. A probe does not create the Home override, but it is not privilege-free.

## Use the app without changing default Home

Build, install and launch the ordinary app using [INSTALL.md](INSTALL.md). On TVs that offer it, LG's built-in Quick Access can make it easy to open without a computer:

1. With Quiet Home open, hold an available number from **1–8** and accept registration if offered.
2. Hold that number later to launch the app.
3. Hold **0** to edit or remove the shortcut.

These are LG's [Quick Access instructions](https://www.lg.com/us/simroom/tvs/user-guide/2024/set-up-quick-access-shortcuts). Availability and whether a developer app is offered vary by TV; if Quiet Home is absent from the picker, use its LG Home app tile. This keeps the physical Home button and system startup destination unchanged. It is a launch shortcut, not a claim to have replaced the native Home route.

## Ask for a model-specific review

Share only the filtered model, software and SDK values, and the actual operation/result or error. A privileged report can also contain settings and local paths; review and redact it before sharing. Do not share pairing passphrases, keys, account tokens, device addresses or private HA configuration.

A useful request to a maintainer is:

> My own TV reports model [full model], firmware [version], SDK [version]. The read-only check reports [status]. I want the native Home behavior and understand it uses one-time privileged execution. Please review these results and the existing SDK/profile guards before proposing changes; do not flash firmware, add root persistence, or bypass failed checks.

An assistant's execution policy is separate from TV compatibility. The inspection report helps establish what the device actually supports; a software patch cannot change another service's execution policy. SDK/profile guards remain in place until a model-specific port has been reviewed.
