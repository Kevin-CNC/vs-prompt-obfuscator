<template>
  <MainMenu
    v-if="currentView === 'menu'"
    :rulesheet-name="rulesheetName"
    :enabled="enabled"
    @navigate="handleNavigate"
    @toggle-enabled="handleToggleEnabled"
  />
  <RuleEditor
    v-else-if="currentView === 'rules'"
    :rulesheet-name="rulesheetName"
    :rules="rules"
    @back="currentView = 'menu'"
    @save-rules="handleSaveRules"
  />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import MainMenu from './components/MainMenu.vue';
import RuleEditor from './components/RuleEditor.vue';

const vscode = acquireVsCodeApi();

// ---- Reactive state ----
const currentView = ref<'menu' | 'rules'>('menu');
const rulesheetName = ref('Loading...');
const enabled = ref(false);

interface SimpleRule {
  id: string;
  pattern: string;
  replacement: string;
}
const rules = ref<SimpleRule[]>([]);

// ---- Navigation ----
function handleNavigate(view: string) {
  if (view === 'rules') {
    currentView.value = 'rules';
  }
}

// ---- Enable / Disable toggle ----
function handleToggleEnabled() {
  enabled.value = !enabled.value;
  vscode.postMessage({ command: 'toggleEnabled', enabled: enabled.value });
}

// ---- Save rules ----
function handleSaveRules(newRules: SimpleRule[]) {
  rules.value = newRules;
  vscode.postMessage({ command: 'saveRules', rules: newRules });
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
    case 'rulesSaved':
      // Handled by RuleEditor toast
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