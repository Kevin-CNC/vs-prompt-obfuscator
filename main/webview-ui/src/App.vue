<template>
  <main class="container">
    <!-- Header -->
    <header class="header">
      <div class="title-area">
        <span class="codicon codicon-shield" aria-hidden="true"></span>
        <h1 class="title">Prompt Hider</h1>
        <span class="rulesheet-badge" :title="'Active rulesheet: ' + rulesheetName">{{ rulesheetName }}</span>
      </div>
    </header>

    <!-- Rule Editor -->
    <RuleEditor
      :rules="rules"
      @save-rules="handleSaveRules"
      @save-single-rule="handleSaveSingleRule"
      @delete-rule="handleDeleteRule"
    />
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import RuleEditor from './components/RuleEditor.vue';
import {
  provideVSCodeDesignSystem,
  vsCodeButton,
  vsCodeTextField
} from '@vscode/webview-ui-toolkit';

provideVSCodeDesignSystem().register(
  vsCodeButton(),
  vsCodeTextField()
);

const vscode = acquireVsCodeApi();

const rulesheetName = ref('Loading...');
const enabled = ref(false);

interface SimpleRule {
  id: string;
  pattern: string;
  replacement: string;
}
const rules = ref<SimpleRule[]>([]);

function handleSaveRules(newRules: SimpleRule[]) {
  rules.value = newRules;
  vscode.postMessage({ command: 'saveRules', rules: newRules });
}

function handleSaveSingleRule(rule: SimpleRule) {
  const idx = rules.value.findIndex(r => r.id === rule.id);
  if (idx !== -1) {
    rules.value[idx] = rule;
  } else {
    rules.value.push(rule);
  }
  vscode.postMessage({ command: 'saveSingleRule', rule });
}

function handleDeleteRule(ruleId: string) {
  rules.value = rules.value.filter(r => r.id !== ruleId);
  vscode.postMessage({ command: 'deleteRule', id: ruleId });
}

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

onMounted(() => {
  vscode.postMessage({ command: 'ready' });
});
</script>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-sizing: border-box;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  padding: 14px 20px 12px;
  border-bottom: 1px solid var(--vscode-editorGroup-border);
  flex-shrink: 0;
}

.title-area {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-area .codicon {
  font-size: 17px;
  color: var(--vscode-textLink-foreground);
  opacity: 0.9;
}

.title {
  font-size: 16px;
  font-weight: 700;
  color: var(--vscode-editor-foreground);
  margin: 0;
  letter-spacing: -0.01em;
}

.rulesheet-badge {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 10px;
  background-color: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  letter-spacing: 0.02em;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>