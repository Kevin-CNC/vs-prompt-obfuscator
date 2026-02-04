<template>
  <div class="app">
    <h2>Prompt Hider - Rule Editor</h2>
    <p class="description">
      TODO: Build the rule editor UI
    </p>

    <div class="actions">
      <button @click="handleAction">Test Button</button>
    </div>

    <!-- TODO: Add components for:
      - Rule list display
      - Rule creation form
      - Rule editing
      - Enable/disable toggles
    -->
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

// TODO: Define interfaces for rules

// TODO: Get VS Code API
// declare const acquireVsCodeApi: () => any;
// const vscode = acquireVsCodeApi();

function handleAction() {
  // TODO: Implement communication with extension
  console.log('Button clicked');
}

// TODO: Listen for messages from the extension
</script>

<style scoped>
.app {
  padding: 20px;
  font-family: var(--vscode-font-family);
  color: var(--vscode-foreground);
}

button {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  padding: 8px 16px;
  cursor: pointer;
}

button:hover {
  background: var(--vscode-button-hoverBackground);
}
</style>
