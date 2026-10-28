# Optional Home Assistant integration

The public app has HA disabled and makes no HA requests. The integration runs inside an existing Home Assistant instance, not on a new host server or TV daemon. It exposes only your configured device allowlists through a random local capability; no HA account token goes into the TV package.

## Generate your own private configuration

```sh
mkdir -p .local
cp config/local.example.json .local/config.json
```

Edit the copied file. Set your HA HTTP(S) origin and your own actual entity IDs. Use HA's entity list to distinguish a Shelly-controlled sink **switch** from a Hue kitchen **light**; they are separate targets. The sample names are examples, not discovered devices.

`lights` supports `light`/`switch` entities in Living room and Kitchen. Dimmer, warmth and RGB controls follow reported capabilities; an ordinary Shelly relay gets power only. `controls` supports `fan`, `cover` and `media_player` entities; unsupported actions are not shown. Avoid duplicate Hue group entities for the same physical lights.

In `tvTime`, select the dimmable TV light, dimmable backlight and explicit `off` entities. The generated example scene sets TV light to 20% (51/255), TV backlight to 80% (204/255), and turns off both the kitchen light and sink switch. Omit `tvTime` if using an existing scene instead.

```sh
python3 -I scripts/configure_ha.py --check
python3 -I scripts/configure_ha.py
```

The script validates IDs/types and generates fresh random capability/webhook values where placeholders are present. It writes only ignored `.local/` files with restrictive permissions. It does **not** contact HA, activate a scene, alter lights, merge HA YAML or restart HA. Existing locally generated secrets are retained on repeat runs.

## Install the connector

For a writable HA config directory:

```sh
python3 -I scripts/install_ha_connector.py --ha-config /path/to/your/ha/config
```

For an existing HA Docker container whose config is owned by its container user:

```sh
python3 -I scripts/install_ha_connector.py --container homeassistant
```

Both modes copy `home-assistant/custom_components/quiet_home_lights/`, write the generated `quiet_home_lights.yaml` and add only this include:

```yaml
quiet_home_lights: !include quiet_home_lights.yaml
```

They back up `configuration.yaml` under `quiet_home_backups/` inside that config directory and refuse an existing connector instead of overwriting it. A failed write attempts to remove the new owned files and restore the prior root configuration. Scenes and automations are not changed by this installer.

## Add the optional scene and webhooks

The generated `.local/ha/scene-to-merge.yaml` and `automations-to-merge.yaml` are JSON-formatted YAML **lists**. Review them and merge their items into your existing `scenes.yaml` and `automations.yaml` lists using an authorized HA file editor. **Do not replace those complete files or create duplicate IDs.** Make separate backups first. If using an existing scene, omit the generated scene and set its actual `scene.entity_id` in `.local/config.json`.

Ensure your root HA configuration already includes its scene and automation files, commonly:

```yaml
scene: !include scenes.yaml
automation: !include automations.yaml
```

Do not add duplicate root keys if your installation organizes these through packages or another include layout. Validate configuration using HA's configuration-check facility. In Docker the equivalent is:

```sh
docker exec homeassistant python3 -m homeassistant --script check_config --config /config
```

Restart HA to load the new custom component, or follow your installation's normal restart process. On the original setup this used the existing container. Check the scene's actual entity ID afterward: HA may assign a suffix if a name already exists. Update the scene ID in the generated automation action **and** `.local/config.json` if necessary. Test scene actions once from HA before relying on TV time.

The webhook automation accepts local POST only and targets one explicit scene. `dry_run=1` skips the action for connectivity checks. The capability endpoint supports file-origin CORS, enforces a local source and validates entity/action/types/bounds/features before dispatch. Access must remain within your trusted local network; a capability is still a credential.

## Build and use

```sh
npm run package
npx ares-install --device friend-tv dist/com.quiet.home_0.9.0_all.ipk
```

Only the ignored build/package contains your origin and capabilities. The tracked source remains connection-free. Never publish your personalized IPK or build output.

Lights opens the living-room/kitchen popup; Controls opens purifiers, shutters and audio. Reads stop when the popup closes or the app is hidden. Slider requests coalesce; shutter Stop cancels a queued unsent position change. Settings → Scene button chooses which configured scene appears at Home; selecting it there does not activate it. Manual light adjustments do not edit the saved scene.

## Remove

Remove only the connector include, its own settings file and its own custom component directory, then restart HA. This revokes the light/control capability. Remove only the specific Quiet Home automation(s) and scene(s) you added; do not restore a full old HA configuration over newer unrelated work. Removing the webhook automation revokes its webhook. LG Home routing and remote settings are independent.
