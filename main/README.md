# VS Prompt Hider

Privacy-preserving middleware for AI assistants - anonymize sensitive data before sending prompts to LLMs.

## Features

- **Auto-Anonymization**: Automatically detect and anonymize sensitive data
- **Token Mappings**: Consistent token replacement across sessions
- **Custom Rules**: Define your own anonymization patterns
- **Visual UI**: Manage rules and mappings through an intuitive interface

## Setup & Development

1. Install dependencies:
   ```bash
   npm install
   cd webview-ui && npm install && cd ..
   ```

2. Build the webview:
   ```bash
   npm run webview:build
   ```

3. Compile the extension:
   ```bash
   npm run compile
   ```

4. Press F5 to debug

## TODO

- [ ] Add PNG icon (SVG not supported): create a 128x128 PNG at `images/icon.png`
- [ ] Implement AnonymizationEngine core logic
- [ ] Complete webview UI components
- [ ] Add more built-in patterns (IPv6, UUIDs, credit cards, etc.)

## Commands

- `Prompt Hider: Create Rulesheet` - Initialize a new rulesheet
- `Prompt Hider: Open Main UI` - Open the main webview interface
- `Prompt Hider: Toggle Auto-Anonymization` - Enable/disable auto-anonymization
- `Prompt Hider: Show Token Mappings` - View current token mappings
- `Prompt Hider: Clear Token Mappings` - Reset all mappings

## License

MIT
