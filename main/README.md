# VS Prompt Hider

**Privacy-preserving middleware for AI assistants** - Automatically anonymize sensitive data before sending prompts to LLMs.

## Features

- 🛡️ **Real-time anonymization** of sensitive data in your code/logs
- 🔄 **Consistent token mapping** - same value gets same token
- 📝 **Project-scoped rules** via `.prompthider.json`
- 🎯 **10+ built-in patterns** (IPs, emails, API keys, UUIDs, etc.)
- 👁️ **Preview mode** - see what will be anonymized before sending
- 📊 **Token mapping viewer** - track original values
- ⚡ **Zero configuration** - works out of the box

## Quick Start

1. Install the extension from VS Code Marketplace
2. Select text containing sensitive data
3. Right-click → "Anonymize Selection"
4. The anonymized text is automatically copied to your clipboard

## Built-in Pattern Detection

- IPv4/IPv6 addresses → `IP_1`, `IP_2`
- Email addresses → `USER_A@domain.tld`
- UUIDs → `UUID_1`
- API Keys (OpenAI, AWS, GitHub, Slack) → `API_KEY_v1`
- JWT tokens → `JWT_TOKEN_1`
- Private keys → `PRIVATE_KEY_1`

## Configuration

### Global Settings

Access via Settings → Extensions → Prompt Hider:

- `prompthider.autoAnonymize` - Enable/disable automatic anonymization
- `prompthider.showPreview` - Show preview before anonymizing
- `prompthider.tokenConsistency` - Use consistent tokens across sessions
- `prompthider.enabledPatterns` - Select which patterns to detect

### Project-Specific Rules

Create a `.prompthider.json` file in your project root:

\`\`\`json
{
  "version": "1.0",
  "enabled": true,
  "rules": [
    {
      "id": "custom-api-key",
      "type": "secret",
      "pattern": "myapp_key_[a-zA-Z0-9]{32}",
      "replacement": "MYAPP_KEY_{index}",
      "enabled": true,
      "description": "Custom app API keys"
    }
  ]
}
\`\`\`

## Commands

- `Prompt Hider: Anonymize Selection` - Anonymize selected text
- `Prompt Hider: Open Rule Editor` - Open the rule editor panel
- `Prompt Hider: Show Token Mappings` - View all token → value mappings
- `Prompt Hider: Toggle Auto-Anonymization` - Enable/disable auto mode
- `Prompt Hider: Clear Token Mappings` - Reset all mappings

## Compatibility

### VS Code Forks

✅ **VS Code** - Full support  
✅ **Cursor** - Full support (same extension API)  
✅ **Windsurf** - Full support (VS Code fork)  
✅ **VSCodium** - Full support  
⚠️ **Other editors** - Check if they support VS Code extensions

Most VS Code forks (Cursor, Windsurf, VSCodium, Code-OSS) are compatible because they use the same extension API. The extension will work seamlessly across these editors.

## Development

### Prerequisites

- Node.js 20+
- npm or yarn

### Setup

\`\`\`bash
# Install extension dependencies
npm install

# Install webview dependencies
cd webview-ui && npm install && cd ..

# Compile extension
npm run compile

# Watch for changes
npm run watch
\`\`\`

### Running in Development

1. Open this folder in VS Code
2. Press `F5` to open a new Extension Development Host window
3. Test the extension in the development window

### Building

\`\`\`bash
# Build for production
npm run package

# Package as .vsix
npx vsce package
\`\`\`

## Documentation Links

### VS Code Extension Development
- **Official Extension Guide:** https://code.visualstudio.com/api/get-started/your-first-extension
- **Extension API:** https://code.visualstudio.com/api/references/vscode-api
- **Extension Capabilities:** https://code.visualstudio.com/api/extension-capabilities/overview
- **Webview API:** https://code.visualstudio.com/api/extension-guides/webview
- **Publishing:** https://code.visualstudio.com/api/working-with-extensions/publishing-extension

### Vue.js Integration
- **Vue 3 Docs:** https://vuejs.org/guide/introduction.html
- **Webview UI Toolkit:** https://github.com/microsoft/vscode-webview-ui-toolkit
- **Vite:** https://vitejs.dev/guide/

### TypeScript
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/handbook/intro.html
- **TS with Vue:** https://vuejs.org/guide/typescript/overview.html

## Architecture

\`\`\`
src/
├── extension.ts              # Extension entry point
├── anonymizer/
│   ├── AnonymizationEngine.ts  # Core anonymization logic
│   ├── TokenManager.ts         # Token generation & mapping
│   └── PatternLibrary.ts       # Built-in patterns
├── ui/
│   ├── RuleEditorProvider.ts   # Webview provider for rules
│   └── MappingsViewProvider.ts # Tree view for mappings
└── utils/
    ├── ConfigManager.ts        # Config file management
    └── getNonce.ts            # Security utility

webview-ui/                   # Vue.js frontend
├── src/
│   ├── App.vue              # Main Vue component
│   ├── main.ts              # Vue app entry
│   └── style.css
└── vite.config.ts           # Vite build config
\`\`\`

## Privacy & Security

- ✅ All anonymization happens **locally** on your machine
- ✅ No data is sent to external servers (free tier)
- ✅ Token mappings are stored in VS Code's workspace state
- ✅ `.prompthider.json` can be gitignored to avoid sharing rules

## Roadmap

- [ ] AI-powered pattern detection
- [ ] Team rule sharing (premium)
- [ ] Rules federation (premium)
- [ ] Browser extension for ChatGPT web
- [ ] JetBrains IDE plugin

## Contributing

Contributions welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT

## Support

- 🐛 Report bugs: https://github.com/Kevin-CNC/vs-prompt-hider/issues
- 💬 Discussions: https://github.com/Kevin-CNC/vs-prompt-hider/discussions
- 📧 Email: support@prompthider.dev

---

**Keep Your Secrets. Keep Using AI.**
