# Cloakd

<div align="center">
  <img src="./main/images/icon.svg" alt="Cloakd Logo" width="96" height="96"/>
  
  **Anonymize sensitive data before it reaches language models.**
</div>

---

## Table of Contents

| Section | Purpose |
|---------|---------|
| [Overview](#overview) | What Cloakd does |
| [Features](#features) | Key capabilities |
| [Getting Started](#getting-started) | Quick setup guide |
| [Configuration](#configuration) | Settings reference |
| [Architecture](#architecture) | How it works |
| [License](#license) | Licensing information |

---

## Overview

Cloakd is a VS Code extension that automatically anonymizes sensitive values before they're sent to language models. It maintains a strict privacy boundary: secrets are anonymized before reaching the LM, de-anonymized only in local tool implementations, and re-anonymized before returning results.

**What it solves:**
- API keys, passwords, and credentials sent to language models
- Infrastructure details exposed in prompts and responses
- De-anonymization leaking secrets back to external systems
- Manual tracking of sensitive information across prompts

---

## Features

**Anonymous Pattern Matching** — Regex-based patterns with built-in support for IPs, emails, UUIDs, API keys, JWT tokens, and private keys.

**Rule Editor** — Vue.js interface for managing anonymization rules in per-workspace `.prompthider/` files.

**IaC Scanner** — Detects Terraform secrets (AWS account IDs, ARNs, CIDR blocks, credentials) and suggests rules.

**Token Consistency** — Maps secrets to stable tokens (e.g., `IP_1`, `API_KEY_2`) for reliable LM interaction.

**LM Tool Integration** — Three tools with full anonymization: command execution, SCP transfers, and filesystem operations.

**@PromptHider Chat Participant** — Built-in VS Code Chat integration with automatic anonymization.

---

## Technology Stack

TypeScript • VS Code Extension API • Vue.js 3 • Tailwind CSS • Vite • Webpack • JSON

---

## Commands

- `prompthider.activate` — Activate extension with ruleset selection
- `prompthider.openUI` — Open main rule editor panel
- `prompthider.openRuleEditor` — Open sidebar rule editor
- `prompthider.showMappings` — Display current token mappings
- `prompthider.clearMappings` — Clear all token mappings
- `prompthider.scanIacFile` — Scan file for detectable secrets
- `prompthider.switchRulesheet` — Switch active ruleset
- `prompthider.quickAddRule` — Add a rule from command palette

---

## Getting Started

**Installation:**
1. Open VS Code Extensions (Ctrl+Shift+X)
2. Search for "Cloakd" and install

**Setup:**
1. Run command: `PromptHider: Open UI`
2. Create a new ruleset (e.g., `my-project`)
3. Add rules manually or use the IaC scanner to detect secrets
4. In VS Code Chat, use `@PromptHider` to anonymize your prompts

**Example rule:**
```json
{
  "id": "rule-1",
  "type": "ip",
  "pattern": "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b",
  "replacement": "IP",
  "enabled": true
}
```

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `prompthider.agent.maxToolRounds` | `10` | Max tool execution rounds |
| `prompthider.agent.executionMode` | `captured` | Tool mode: `captured` or `terminal` |
| `prompthider.agent.toolScope` | `all` | Available tools: `prompthiderOnly` or `all` |
| `prompthider.mappings.autoClearOnSessionStart` | `false` | Clear mappings on new session |
| `prompthider.mappings.autoClearOnRulesheetSwitch` | `false` | Clear mappings on ruleset switch |
| `prompthider.logging.level` | `info` | Log level: `debug`, `info`, `warn`, `error` |

---

## Architecture

**Anonymization Engine** — Loads enabled rules, compiles regex patterns (longest-first), finds non-overlapping matches, generates consistent tokens, and replaces in reverse order.

**Token Manager** — Maintains mappings between original values and tokens, persisted in VS Code's `workspaceState`.

**IaC Scanner** — Detects Terraform-specific secrets or uses generic fallback patterns.

**LM Tools** — Three tools with full de/re-anonymization:
- `prompthider_execute_command` — Run shell commands safely
- `prompthider_scp_transfer` — Secure file transfers
- `prompthider_filesystem` — File read/write/patch/delete operations

**Privacy Boundary:**
1. Input anonymized before reaching the LM
2. De-anonymized only in local tool code
3. Tool outputs re-anonymized before returning to model

---

## License

Kept under MIT licence as of 08/02/2026 (dd/mm/yy).

---

## Support

Questions or issues? Open a GitHub issue in the project repository.
