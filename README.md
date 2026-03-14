# Cloakd

<div align="center">
  <img src="./main/images/icon.svg" alt="Cloakd Logo" width="96" height="96"/>

  <b>Anonymize sensitive data before it reaches language models.</b>
</div>

---

## What is Cloakd?

Cloakd is a VS Code extension that helps developers use AI safely by replacing sensitive values with anonymized tokens before data reaches language models.

You keep the same workflow, but Cloakd adds a privacy layer.

Example:

- Input: `ssh dev@10.24.3.9 with token sk_live_XYZ`
- Model sees: `ssh USER_1@IP_1 with token API_KEY_1`

---

## Why it helps beginners and teams

- Reduces accidental secret leakage in AI prompts.
- Keeps responses usable with stable token names.
- Supports local tool execution workflows with privacy boundaries.
- Makes policy and rule management visual from the main UI.

---

## Newest Features

### Dynamic Wrapped Tools

When enabled, Cloakd can wrap non-native tools with aliases such as `cloakd_wrap_<toolName>` and apply trust policy before invocation.

### Wrapped Tool Trust Policy submenu

Main UI now has a dedicated submenu for wrapped-tool controls:

- Enable/disable wrapping
- Select mode (`strict`, `balanced`, `trustedLocal`)
- Configure optional JSON per-tool policies

### Rule Addition submenu

Rule management and scanning actions live in a separate submenu to keep the main interface cleaner.

### Safer settings writes

Dynamic wrapping settings use supported scope behavior to avoid common configuration write errors.

---

## Quick Start

1. Install Cloakd from VS Code Extensions.
2. Open `Cloakd: Open Main UI`.
3. Create a rulesheet with `Cloakd: Create Rulesheet`.
4. Add or scan rules in `Rule Addition`.
5. Use `@Cloakd` in VS Code Chat.

Tip: Cloakd protections are intended for the `@Cloakd` participant flow.

---

## Core Workflows

### Create and maintain rules

- Use `Cloakd: Quick Add Rule` to turn selected text into a rule.
- Use file scanners to detect likely secrets.
- Save rulesheet updates in the UI.

### Work with AI chat safely

- Ask your questions in `@Cloakd`.
- Cloakd anonymizes matching values before model access.
- Tokens remain consistent for easier follow-up prompts.

### Use local tools with privacy boundaries

Built-in tools:

- `cloakd_execute_command`
- `cloakd_scp_transfer`
- `cloakd_filesystem`

These tools perform local de-anonymization only where required and sanitize outputs on return paths.

---

## Commands

- `cloakd.activate` - Create Rulesheet
- `cloakd.openUI` - Open Main UI
- `cloakd.openRuleEditor` - Open Rule Editor
- `cloakd.switchRulesheet` - Switch Active Rulesheet
- `cloakd.showMappings` - Show Token Mappings
- `cloakd.clearMappings` - Clear Token Mappings
- `cloakd.anonymize` - Anonymize Selection
- `cloakd.quickAddRule` - Quick Add Rule
- `cloakd.scanCurrentFile` - Scan Current File for Secrets
- `cloakd.scanSecrets` - Scan File for Secrets
- `cloakd.scanIacFile` - Scan IaC File for Patterns

Default shortcuts:

- `Ctrl+Shift+A` - Quick Add Rule
- `Ctrl+Alt+S` - Scan Current File for Secrets
- `Ctrl+Alt+Shift+S` - Scan File for Secrets

---

## Configuration (Current Defaults)

| Setting | Default | Description |
|---------|---------|-------------|
| `cloakd.agent.maxToolRounds` | `10` | Maximum LM tool-call rounds in one loop |
| `cloakd.agent.executionMode` | `captured` | Tool execution mode: `captured` or `terminal` |
| `cloakd.agent.toolScope` | `cloakdOnly` | Expose only Cloakd tools or all tools |
| `cloakd.agent.dynamicToolWrapping.enabled` | `false` | Enable wrapped aliases for non-Cloakd tools |
| `cloakd.agent.dynamicToolWrapping.mode` | `strict` | Baseline trust policy mode |
| `cloakd.agent.dynamicToolWrapping.policies` | `{}` | Optional `defaultPolicy` and `perTool` overrides |
| `cloakd.mappings.autoClearOnSessionStart` | `true` | Auto-clear mappings at session start |
| `cloakd.mappings.autoClearOnRulesheetSwitch` | `true` | Deprecated compatibility setting |
| `cloakd.logging.level` | `warn` | Log verbosity |

---

## Privacy Model (Simple)

1. Before model: anonymize.
2. During trusted local tool execution: de-anonymize only if needed.
3. Returning results: re-anonymize text-bearing output.

---

## Limitations

- Protection is strongest in `@Cloakd` chat workflows.
- Poor rule quality can create false positives or missed matches.
- Trust policies should be conservative unless tools are verified.

---

## Troubleshooting

### UI does not reflect latest changes

1. Run `npm --prefix main run webview:build`.
2. Reload VS Code window.

### Wrapped Tool Trust Policy settings fail to save

- Update to latest extension build.
- Save from the dedicated submenu.
- Reload VS Code after updates to contributed settings metadata.

### Results still include raw sensitive values

1. Ensure you are using `@Cloakd`.
2. Verify rules are enabled.
3. Test with a known value that should match.

---

## License

MIT.

## Support

Open a GitHub issue with reproducible steps and redacted logs.
