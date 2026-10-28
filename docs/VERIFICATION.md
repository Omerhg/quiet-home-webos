# What was verified

## Original personal installation

A 2026 LG G6 on software 43.21.79 and SDK 11.2.0 was used to inspect native Home behavior, temporarily run a bounded privileged profile operation, preserve AOD/settings, reach LG Home, restore the original profile, recover from a missing custom profile, and perform full restarts into both LG Home and the custom launcher.

Guide-to-Mute worked as an ordinary app action and was confirmed with physical presses. Its original native setting was restored and re-enabled during the earlier verification. Navigation/hover and cached glass rendering were sampled on the TV. The optional HA connector's local reads, CORS, validation and original light controls were checked against that installation. The expanded later button editor and purifier/shutter/audio controls were covered by simulated-service browser tests; not every physical key/device action was exercised. No universal model/firmware compatibility is claimed.

## Public version

The public version changes the app IDs to `com.quiet.home` / `com.quiet.mute`, removes original connection data and the private bookmark, uses generic HDMI labels and original monogram artwork, captures each recipient's remote originals, and leaves HA disabled by default. Generated local configuration never changes tracked source.

Checks cover:

- 32 browser scenarios for the shared 0.9.0 UI, favorites, inputs, Settings, cursor/arrow navigation, scrolling, photos/Scenery, scenes, lights and the remote/control editors using isolated service fixtures.
- 19 native Home / remote-policy checks, including probe-only behavior, exact intended profile scope, unrelated-file protection, mismatched-baseline refusal, rollback after failure, owned dangling-link restoration and single-button update scope.
- 17 HA policy checks covering allowlists, service/action/type/bound restrictions, unsupported features, offline handling and switch-only behavior.
- Private configuration generation, source/build separation, and bounded connector installation/refusal checks.
- Syntax checks, webOS package creation, public-file auditing, known-private-value comparison and Gitleaks scanning of files/history before publication.

These checks establish the local source's behavior and publication hygiene. The renamed public packages, generic installers and setup automation have not been installed on a second TV. Browser screenshots and mocked services do not prove another device's physical key routing, privileges, reboot behavior or recovery. Probe and test the actual recipient's device before relying on it.
