<template>
  <div class="rule-editor-container">
    <vscode-data-grid :rows-data="localRules" grid-template-columns="1fr 1fr 120px" aria-label="Anonymization Rules">
      <vscode-data-grid-row row-type="header">
        <vscode-data-grid-cell cell-type="columnheader" grid-column="1">Pattern (Regex)</vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="2">Replacement</vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="3">Actions</vscode-data-grid-cell>
      </vscode-data-grid-row>
      <vscode-data-grid-row
        v-for="(rule, index) in localRules"
        :key="rule.id"
        :class="{ 'row-dirty': dirtyIds.has(rule.id) }"
      >
        <vscode-data-grid-cell grid-column="1">
          <vscode-text-field
            :value="rule.pattern"
            @input="updateRule(index, 'pattern', $event.target.value)"
            placeholder="e.g., API_KEY_\\w+"
            class="w-full"
          ></vscode-text-field>
        </vscode-data-grid-cell>
        <vscode-data-grid-cell grid-column="2">
          <vscode-text-field
            :value="rule.replacement"
            @input="updateRule(index, 'replacement', $event.target.value)"
            placeholder="e.g., API_KEY_{index}"
            class="w-full"
          ></vscode-text-field>
        </vscode-data-grid-cell>
        <vscode-data-grid-cell grid-column="3" class="actions-cell">
          <span v-if="dirtyIds.has(rule.id)" class="unsaved-indicator" title="Unsaved changes">●</span>
          
          <!-- Delete button -->
          <vscode-button appearance="icon" @click="requestRemoveRule(index)" aria-label="Delete rule">
            <span class="codicon codicon-trash"></span>
          </vscode-button>
          <!-- Delete button -->


          <!-- Save Rule button -->
          <vscode-button appearance="icon" @click="saveSingleRule(index)" aria-label="Save rule">
            <span class="codicon codicon-save"></span>
          </vscode-button>
          <!-- Save Rule button -->
          

        </vscode-data-grid-cell>
      </vscode-data-grid-row>
    </vscode-data-grid>

    <div class="footer-actions">
      <div class="footer-group">
        <vscode-button appearance="primary" @click="addRule">
          <span slot="start" class="codicon codicon-plus"></span>
          Add Rule
        </vscode-button>
        <vscode-button appearance="secondary" @click="confirmRules">Save All Rules</vscode-button>
      </div>
      <div class="footer-group">
        <vscode-switch :checked="enabled" @change="$emit('toggleEnabled')">
          Anonymization
        </vscode-switch>
        <vscode-button appearance="secondary" disabled title="This feature is under development">Export/Import Rules</vscode-button>
      </div>
    </div>

    <div v-if="showSaved" class="save-feedback" role="status" aria-live="polite">
      Rules saved successfully!
    </div>

    <div v-if="showSingleSaved" class="save-feedback" role="status" aria-live="polite">
      Rule saved successfully!
    </div>

    <!-- Deletion Confirmation Dialog -->
    <div v-if="ruleToDelete" class="dialog-overlay">
      <div class="dialog-content" role="alertdialog" aria-labelledby="dialog-title" aria-describedby="dialog-description">
        <h2 id="dialog-title" class="dialog-title">Delete Pattern</h2>
        <p id="dialog-description" class="dialog-description">
          Are you sure you want to delete the pattern "{{ ruleToDelete.rule.pattern }}"? This action cannot be undone.
        </p>
        <div class="dialog-actions">
          <vscode-button appearance="secondary" @click="cancelRemoveRule">Cancel</vscode-button>
          <vscode-button appearance="primary" @click="confirmRemoveRule" class="delete-button">Delete</vscode-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

export interface RuleRow {
  id: string;
  pattern: string;
  replacement: string;
}

const props = defineProps<{
  rules: { id: string; pattern: string; replacement: string }[];
  enabled: boolean;
}>();

const emit = defineEmits<{
  (e: 'saveRules', rules: { id: string; pattern: string; replacement: string }[]): void;
  (e: 'saveSingleRule', rule: { id: string; pattern: string; replacement: string }): void;
  (e: 'deleteRule', ruleId: string): void;
  (e: 'toggleEnabled'): void;
}>();

const localRules = ref<RuleRow[]>([]);
const showSaved = ref(false);
const showSingleSaved = ref(false);
const ruleToDelete = ref<{ rule: RuleRow; index: number } | null>(null);
const dirtyIds = ref<Set<string>>(new Set());

watch(
  () => props.rules,
  (newRules) => {
    const incoming: RuleRow[] = JSON.parse(JSON.stringify(newRules || []));

    if (localRules.value.length === 0) {
      // First load — take everything as-is
      localRules.value = incoming;
      return;
    }

    // Merge: keep dirty rows untouched, update clean rows with latest prop values
    const incomingMap = new Map(incoming.map(r => [r.id, r]));

    // Update existing clean rows and add new rows from props
    const merged: RuleRow[] = localRules.value.map(local => {
      if (dirtyIds.value.has(local.id)) {
        return local; // Keep unsaved edits
      }
      return incomingMap.get(local.id) ?? local;
    });

    // Add any brand-new rows from props that don't exist locally yet
    for (const incoming of (newRules || [])) {
      if (!merged.find(r => r.id === incoming.id)) {
        merged.push(JSON.parse(JSON.stringify(incoming)));
      }
    }

    localRules.value = merged;
  },
  { immediate: true, deep: true }
);

function generateId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function addRule() {
  localRules.value.push({
    id: generateId(),
    pattern: '',
    replacement: '',
  });
}

function requestRemoveRule(index: number) {
  const rule = localRules.value[index];
  if (rule) {
    ruleToDelete.value = { rule, index };
  }
}

function confirmRemoveRule() {
  if (ruleToDelete.value !== null) {

    const ruleToDeleteID = ruleToDelete.value.rule.id;

    localRules.value.splice(ruleToDelete.value.index, 1);
    ruleToDelete.value = null;
    
    emit('deleteRule', ruleToDeleteID);
  }
}

function cancelRemoveRule() {
  ruleToDelete.value = null;
}

function updateRule(index: number, field: 'pattern' | 'replacement', value: string) {
  if (localRules.value[index]) {
    localRules.value[index][field] = value;
    // Mark this row as having unsaved changes
    dirtyIds.value = new Set([...dirtyIds.value, localRules.value[index].id]);
  }
}

function saveSingleRule(index: number) {
  const ruleToSave = localRules.value[index];

  if (ruleToSave.pattern.trim() !== '' || ruleToSave.replacement.trim() !== ''){
    emit('saveSingleRule', {
      id: ruleToSave.id,
      pattern: ruleToSave.pattern.trim(),
      replacement: ruleToSave.replacement.trim(),
    });

    // Row is now saved — remove from dirty tracking
    const next = new Set(dirtyIds.value);
    next.delete(ruleToSave.id);
    dirtyIds.value = next;

    showSingleSaved.value = true;
    setTimeout(() => {
      showSingleSaved.value = false;
    }, 2500);
  }
}

function confirmRules() {
  const validRules = localRules.value
    .filter((r) => r.pattern.trim() !== '' || r.replacement.trim() !== '')
    .map((r) => ({
      id: r.id,
      pattern: r.pattern.trim(),
      replacement: r.replacement.trim(),
    }));

  localRules.value = validRules;
  // All rows saved — clear all dirty state
  dirtyIds.value = new Set();

  emit('saveRules', validRules);

  showSaved.value = true;
  setTimeout(() => {
    showSaved.value = false;
  }, 2500);
}
</script>

<style scoped>
.rule-editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
  padding: 0 24px 24px 24px;
  box-sizing: border-box;
}

vscode-data-grid {
  flex-grow: 1;
}

.actions-cell {
  display: flex;
  align-items: center;
  justify-content: center;
}

.w-full {
  width: 100%;
}

.footer-actions {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid var(--vscode-editorGroup-border);
  background-color: var(--vscode-editor-background);
  box-shadow: 0 -4px 12px -4px var(--vscode-scrollbar-shadow);
}

.footer-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.save-feedback {
  position: fixed;
  bottom: 80px; /* Adjusted for footer */
  right: 24px;
  background-color: var(--vscode-statusBar-background);
  color: var(--vscode-statusBar-foreground);
  padding: 8px 16px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: opacity 0.3s ease;
  z-index: 100;
}

/* Dialog Styles */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.dialog-content {
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  padding: 24px;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 400px;
  border: 1px solid var(--vscode-editorGroup-border);
}

.dialog-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 12px 0;
}

.dialog-description {
  margin: 0 0 24px 0;
  color: var(--vscode-descriptionForeground);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.delete-button::part(control) {
  background-color: var(--vscode-errorForeground);
  color: var(--vscode-button-foreground);
}

.row-dirty {
  border-left: 3px solid var(--vscode-inputValidation-warningBorder, #cca700);
  background-color: var(--vscode-inputValidation-warningBackground, rgba(204, 167, 0, 0.05));
}

.unsaved-indicator {
  color: var(--vscode-inputValidation-warningBorder, #cca700);
  font-size: 10px;
  margin-right: 4px;
  flex-shrink: 0;
  align-self: center;
}
</style>
