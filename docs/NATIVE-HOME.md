# Make Quiet Home the native Home destination

This reproduces a protected, firmware-specific operation performed on an owned 2026 G6, software 43.21.79 / SDK 11.2.0. The normal `prisoner` SSH account cannot perform it. Firmware downloaded during the original research was inspected locally and never flashed; no firmware download is needed here.

For a different model or SDK, see [the agent porting guide](PORTING-FOR-AGENTS.md) before modifying the trusted-app route or profile checks. It explains how to investigate and validate a bounded adaptation while retaining restoration.

## What changes

The app manifest registers the `home` category. Its bundled `home-profile.json` contains only:

```json
{
  "defaultApps": {"categories": {"home": "com.quiet.home"}},
  "idleApp": {"appId": "com.quiet.home"}
}
```

The one retained system-side link is:

```text
/var/webos-profile/override/quiet-home.json
  -> /media/developer/apps/usr/palm/applications/com.quiet.home/home-profile.json
```

LG's profile loader follows it. Original LG Home (`com.webos.app.home`), AOD and other settings are retained. The small LG Home tile visits the original app without changing the default.

## Why temporary privilege is involved

The reviewed voiceweb → jsserver path uses a trusted local page and a staged one-shot module. A service-path check and the argument parser select different paths around `--`; the checked service stays under `/usr/palm/services`, while the executed module is the staged bounded profile operation. This is related to [SlopBro](https://github.com/throwaway96/slopbro) and Dualbro/WTFBro research.

The helper calls that path only for its own probe/apply/restore operation. It does not invoke an upstream root-persistence installer, install Homebrew Channel, open a root SSH/Telnet listener, replace firmware, modify LG Home binaries or add a boot-time watcher. A restart clears the temporary execution context; it does not patch the underlying firmware vulnerability or erase logs.

## Probe first

Start with the **ordinary read-only inspection**, especially on a different model or software version:

```sh
node scripts/native-home.mjs --device friend-tv --mode inspect
```

This uses only Developer Mode's system-information read. The existing native gate is SDK 11.2.0 plus protected baseline checks; it is not a G6/43.21.79 model/firmware allowlist. A CS5 on 43.21.77 needs its own SDK and baseline reviewed, not an assumed rejection or an assumed match. See [compatibility troubleshooting](COMPATIBILITY.md).

**The following `probe` is different: it invokes the firmware vulnerability and runs with temporary administrator privileges.** It does not apply the profile link, but it is not an unprivileged diagnostic.

Review `scripts/native-home.mjs` and `setup/payload.js`. Ensure the matching public app is already installed. Replace `YOUR_COMPUTER_LAN_IP` with the setup computer's private IPv4 address, not the TV's address:

```sh
node scripts/native-home.mjs --device friend-tv --pc-ip YOUR_COMPUTER_LAN_IP --mode probe
```

The helper starts a temporary HTML-only server on port 8780, stages its own payload, opens it in LG's trusted web app and waits up to 90 seconds. The page is part of one-time setup, not a runtime dependency. The server stops afterward. Successful staging is removed; failed/unclear attempts are retained for diagnosis, with the path printed. Private reports go to `.local/reports/`.

The payload requires UID/EUID 0, SDK 11.2.0, stock Home and idle routes, a supported original profile shape, no explicit Home preference, the exact bundled profile, safe directory permissions and no existing override. If the probe is blocked or the baseline differs, stop; do not try unrelated rooting/persistence installers as a substitute.

## Apply

After a successful probe and manual version/baseline review:

```sh
node scripts/native-home.mjs --device friend-tv --pc-ip YOUR_COMPUTER_LAN_IP --mode apply
```

Apply saves the baseline, creates only the owned link (and its parent directory if missing), requests LG's native profile rescan, and verifies both Home destinations and unchanged settings. A failed verification removes the newly created link and attempts to restore the original profile state. It refuses to overwrite another override.

Test physical Home from an app and an HDMI input, LG Home access from the small tile, and a full restart. Do not rely solely on a screenshot or successful install. These behaviors were checked on the original TV; another recipient must verify their own device.

## Restore

```sh
node scripts/native-home.mjs --device friend-tv --pc-ip YOUR_COMPUTER_LAN_IP --mode restore
```

Restore removes only a symlink at that exact target which points to this app's profile. It also handles an owned dangling link. It refuses an unrelated file/link, rescans, and checks LG Home destinations. It leaves an existing override directory in place. See [rollback](ROLLBACK.md) for app removal and the original device's missing-profile fallback.
