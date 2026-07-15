# Configuration

Matron Desktop reads the same small configuration surface as Matron Web:

| Key | Purpose |
| --- | --- |
| `journal_server_url` | matron-journal base URL. Empty or omitted asks at sign-in. |
| `brand` | Product name shown by the renderer and native shell. |
| `privacy_policy_url` | Optional privacy-policy link on the sign-in screen. |
| `update_base_url` | Static update-feed root for packaged macOS and Windows builds. |
| `help_url` | Optional destination for the native Help menu. |

The bundled variant configuration can be overridden by a user `config.json` or with `MATRON_DESKTOP_CONFIG_JSON`. Fully quit and reopen the app after changing it.

Desktop's request bridge permits HTTPS journal origins and loopback HTTP development origins. It rejects credentials embedded in URLs and prevents request paths from escaping the configured server prefix.
