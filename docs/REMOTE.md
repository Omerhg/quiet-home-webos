# Remote shortcuts

Settings → Remote opens the local button editor using LG's existing trusted web app. This extends the configuration route previously verified for Guide on the original TV. It reads current native assignments; opening the editor and choosing a target do not change a mapping.

- **App buttons:** select a physical app shortcut printed on your remote and assign an installed visible app. The editor requests a fresh installed-app list and falls back to the bundled catalog if listing is unavailable.
- **Other buttons:** Guide, Home Hub and custom ? press/hold appear when the TV exposes their native settings. Choices include apps, HDMI inputs, Lights, Home controls, the chosen Home scene, Scenery, Settings, Quiet Home, LG Home and the input picker.
- **System buttons:** AI/microphone, Alexa, power, Home, Back, OK/arrows, volume and channel handling are not reimplemented. Arbitrary interception would require a different persistent privileged mapper, which this repository does not install.

Use **Save assignment** to apply. The editor reads the current state again, saves that button's original assignment in its local storage, changes the selected entry and verifies readback. Other entries are preserved. **Restore original** puts back that captured value. On a recipient's TV, “original” means the state before their first edit; no original owner's profile is imposed. If you already use a different remapper, restore its defaults first if you want the captured baseline to be LG's factory behavior.

LG can rewrite app shortcuts on restart or regional updates. Reassign them through the editor if that occurs; no background process fights those changes. Physical routing can also differ by firmware or foreground input. The expanded editor is covered by simulated-service browser tests; not every physical button was pressed on the original TV.

## Optional Mute helper

Mute/unmute requires the separate hidden `com.quiet.mute` developer app:

```sh
npm run package:mute
npx ares-install --device friend-tv dist/com.quiet.mute_0.1.2_all.ipk
```

In Settings → Remote → Other shortcut buttons, choose Guide, then Mute/unmute and Save assignment. Verify two real presses mute and unmute without changing volume.

`mute-helper/mute-toggle` is readable Python source. It writes one Mute press/release to the original firmware's `/dev/input/event0` path and exits. It does not run as root, use a private Luna service, make network requests or stay in the background. That ordinary-app device permission was verified on the original G6; it may be denied or differ on another model. If it fails, restore the mapping and inspect that TV's own input permissions rather than widening them.

Restore every button that targets a helper or Home feature **before** uninstalling that app or disabling Developer Mode. Removing an app does not necessarily reset native settings that name it. Keep the editor's saved originals until restoration is complete. Full app removal is in [ROLLBACK.md](ROLLBACK.md).
