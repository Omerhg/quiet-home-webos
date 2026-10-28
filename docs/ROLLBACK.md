# Return to the original setup

## Visit LG Home temporarily

Use the small **LG Home** tile, or Back → LG Home. This visits `com.webos.app.home` while retaining Quiet Home as the native default.

## Restore remote buttons first

For each edited button, use Settings → Remote → Restore original while its target app and the trusted editor still exist. Originals are captured per recipient, before their first edit. Do not clear that editor's app data until restoration is done. Uninstalling Quiet Home or Mute does not necessarily reset native key assignments that name them.

## Restore the native Home destination

Prefer the explicit owned-link operation while Developer Mode is available:

```sh
node scripts/native-home.mjs --device friend-tv --pc-ip YOUR_COMPUTER_LAN_IP --mode restore
```

It removes only the expected symlink and verifies LG's Home/idle destinations after a rescan. It refuses other owners' files or links. The operation uses the same bounded temporary-access method as setup; firmware that patches that method may block it.

On the original G6, removing the developer app's bundled profile and fully restarting the TV triggered native missing-profile recovery into LG Home. The public app uses the same profile shape, but that recovery has not been repeated on another TV. Test the explicit restoration and full restart on your own TV.

After restoring buttons and Home, remove the developer apps if desired:

```sh
npx ares-install --device friend-tv --remove com.quiet.home
npx ares-install --device friend-tv --remove com.quiet.mute
```

Perform a full restart using the TV's normal procedure; Quick Start/standby may not be a full reboot. Original LG Home and firmware were never replaced.

## Remove Home Assistant additions

Remove only the Quiet Home include, `quiet_home_lights.yaml`, and `custom_components/quiet_home_lights/` from your HA config, then restart HA. Delete only the specific webhook automations and optional scene entries you added. Do not overwrite later unrelated HA changes with a whole old config backup. TV and HA removal are independent.

## Restore appearance only

Settings → Background selects Dark glass or a still photo. Settings → Scenery disables the 30-second idle view. Install an older package over the same app ID to retain stored preferences; uninstalling first can erase them. UI rollback does not undo separately saved remote or HA configuration.

Private local configuration and reports are under `.local/`; generated builds/packages are `.build/` and `dist/`. Remove those locally after you no longer need them. They are intentionally absent from this public repository. CLI pairing credentials remain in the CLI's own configuration/key store and are not removed by uninstalling the TV apps. A full factory reset is outside this procedure.
