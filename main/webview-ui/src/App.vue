<template>
  <main class="container">
    <!-- Header -->
    <header class="header">
      <div class="title-container">
        <h1 class="title">Prompt Hider</h1>
        <vscode-tag>{{ rulesheetName }}</vscode-tag>
      </div>
      <div class="actions-container">
        <vscode-switch :checked="enabled" @change="handleToggleEnabled">
          Anonymization Enabled
        </vscode-switch>
      </div>
    </header>

    <!-- Rule Editor View -->
    <RuleEditor
      :rules="rules"
      :enabled="enabled"
      @save-rules="handleSaveRules"
      @save-single-rule="handleSaveSingleRule"
      @toggle-enabled="handleToggleEnabled"
    />
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import RuleEditor from './components/RuleEditor.vue';
import {
  provideVSCodeDesignSystem,
  vsCodeButton,
  vsCodeDataGrid,
  vsCodeDataGridCell,
  vsCodeDataGridRow,
  vsCodeTag,
  vsCodeTextField
} from '@vscode/webview-ui-toolkit';

// Register the VS Code Webview UI Toolkit components
provideVSCodeDesignSystem().register(
  vsCodeButton(),
  vsCodeDataGrid(),
  vsCodeDataGridCell(),
  vsCodeDataGridRow(),
  vsCodeTag(),
  vsCodeTextField()
);

const vscode = acquireVsCodeApi();

// ---- Reactive state ----
const rulesheetName = ref('Loading...');
const enabled = ref(false);

interface SimpleRule {
  id: string;
  pattern: string;
  replacement: string;
}
const rules = ref<SimpleRule[]>([]);

// ---- Enable / Disable toggle ----
function handleToggleEnabled() {
  const newEnabledState = !enabled.value;
  enabled.value = newEnabledState;
  vscode.postMessage({ command: 'toggleEnabled', enabled: newEnabledState });
}

// ---- Save rules ----
function handleSaveRules(newRules: SimpleRule[]) {
  rules.value = newRules;
  vscode.postMessage({ command: 'saveRules', rules: newRules });
}

// ---- Save single rule ----
function handleSaveSingleRule(rule: SimpleRule) {
  // Update the rule in local state
  const idx = rules.value.findIndex(r => r.id === rule.id);
  if (idx !== -1) {
    rules.value[idx] = rule;
  } else {
    rules.value.push(rule);
  }
  vscode.postMessage({ command: 'saveSingleRule', rule });
}

// ---- Listen for messages from the extension host ----
window.addEventListener('message', (event) => {
  const msg = event.data;
  switch (msg.command) {
    case 'init':
      rulesheetName.value = msg.rulesheetName ?? 'Unknown';
      rules.value = msg.rules ?? [];
      enabled.value = msg.enabled ?? false;
      break;
    case 'enabledUpdated':
      enabled.value = msg.enabled;
      break;
  }
});

// ---- Tell the extension we're ready ----
onMounted(() => {
  vscode.postMessage({ command: 'ready' });
});
</script>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  height: 100vh;
  box-sizing: border-box;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--vscode-editorGroup-border);
}

.title-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title {
  font-size: 20px;
  font-weight: 600;
  color: var(--vscode-editor-foreground);
  margin: 0;
}

.actions-container {
  display: flex;
  align-items: center;
  gap: 16px;
}

vscode-switch {
  padding-top: 4px;
}
</style>