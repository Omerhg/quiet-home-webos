# Install and test the ordinary launcher

Record your full TV model, Software Version and internal webOS/SDK version. The original setup used a 2026 G6 on software 43.21.79 and SDK 11.2.0; the same marketing model or SDK alone is not a compatibility guarantee.

## Developer Mode

Follow LG's [official Developer Mode instructions](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app): install the app from LG Apps, sign in with your own developer account, enable Dev Mode Status and restart when prompted. Reopen it and enable Key Server. Keep the displayed case-sensitive passphrase private.

From this repository:

```sh
npm ci
npx ares-setup-device
```

Add an alias such as `friend-tv` using your TV's LAN address, port **9922**, username **prisoner**. Exchange its key interactively and read its system information:

```sh
npx ares-novacom --device friend-tv --getkey
npx ares-device --device friend-tv --system-info
```

CLI settings and private keys live outside this repository. Never commit them, a passphrase, a renewal token, or screenshots of those values.

## Build and install

```sh
npm run package
npx ares-install --device friend-tv dist/com.quiet.home_0.10.0_all.ipk
npx ares-launch --device friend-tv com.quiet.home
```

This installs a normal, separate developer app. It does not yet replace the Home destination.

Test arrows, OK, Back, cursor hover, Settings, favorites, HDMI inputs and the **LG Home** tile. Before applying the native default, confirm the physical Home key still reaches LG Home. Regional app IDs differ; remove unavailable tiles in Settings → Apps and edit `app/catalog.js` to add your own. Generic HDMI names are intentional; customize them locally.

Settings → Background picks rotation/still/dark glass and selected photos. Settings → Scenery controls the 30-second idle view. Back goes up one level: gallery → Background content → category sidebar → Home. Three separate Back presses on Home enter photo mode; menu Back presses do not count. The small hollow dots fill as the sequence progresses and reset after a pause or another action. This is an in-app picture view, not a TV power-off command. Left at the edge of content returns to the category sidebar. Changes save automatically.

## Updating

Rebuild and install the new package over the same app ID. Do not uninstall first if you want to preserve favorites and photo selections. User preferences live in TV app storage; optional HA build configuration lives locally under `.local/`.

Continue with the separate [native Home operation](NATIVE-HOME.md) only after these checks pass. The TV does not run a computer watcher after setup.
