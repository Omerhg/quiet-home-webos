# Security and configuration

This is an owned-device customization with a firmware-specific native Home operation. Read its source and [scope](docs/NATIVE-HOME.md) before running it. The normal UI can be installed without running that operation.

Use the repository only on a TV and HA instance you control or are explicitly authorized to configure. Native Home setup deliberately refuses mismatched baselines and does not install a persistent root service. The underlying firmware issue is not repaired by ending its temporary execution.

Treat random HA capability and webhook URLs as credentials. Keep them inside ignored local configuration/build outputs; the account token is never needed by these scripts. Keep local HA endpoint access within your trusted network. Restore remote mappings before removing apps they name.

Do not include live URLs, credentials, pairing files, HA backups or screenshots of secrets in public issues. Use GitHub's private vulnerability reporting if enabled for this repository; otherwise provide only a minimal public description without exploit payloads against someone else's device or secret material, and arrange a private channel before sharing details.

To check publishable files locally:

```sh
npm run scan
gitleaks git . --redact
```

Only source and examples belong in Git. Native installation reports and personalized packages do not.
