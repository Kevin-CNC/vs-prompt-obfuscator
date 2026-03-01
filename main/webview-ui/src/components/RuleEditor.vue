<template>
  <div class="rule-editor-container">

    <!-- Rules table -->
    <div class="rules-grid-wrapper">
      <div class="grid-header" aria-hidden="true">
        <div class="col-pattern">Pattern (Regex)</div>
        <div class="col-replacement">Replacement</div>
        <div class="col-actions">Actions</div>
      </div>

      <!-- Empty state -->
      <Transition name="fade">
        <div v-if="localRules.length === 0" class="empty-state">
          <span class="codicon codicon-filter" aria-hidden="true"></span>
          <p class="empty-title">No rules yet</p>
          <p class="empty-sub">Click <strong>Add Rule</strong> to create your first anonymization pattern.</p>
        </div>
      </Transition>

      <TransitionGroup name="rule-row" tag="div" class="grid-body">
        <div
          v-for="(rule, index) in localRules"
          :key="rule.id"
          class="grid-row"
          :class="{ 'row-dirty': dirtyIds.has(rule.id) }"
          role="row"
          :aria-label="`Rule ${index + 1}`"
        >
          <!-- Dirty indicator bar (left edge) -->
          <span
            v-if="dirtyIds.has(rule.id)"
            class="dirty-bar"
            title="Unsaved changes"
            aria-label="Unsaved changes"
          ></span>

          <div class="col-pattern">
            <vscode-text-field
              :value="rule.pattern"
              @input="updateRule(index, 'pattern', ($event.target as HTMLInputElement).value)"
              placeholder="e.g., \b\d{1,3}(\.\d{1,3}){3}\b"
              class="field-full"
              aria-label="Pattern"
            ></vscode-text-field>
          </div>

          <div class="col-replacement">
            <vscode-text-field
              :value="rule.replacement"
              @input="updateRule(index, 'replacement', ($event.target as HTMLInputElement).value)"
              placeholder="e.g., IP_TOKEN"
              class="field-full"
              aria-label="Replacement token"
            ></vscode-text-field>
          </div>

          <div class="col-actions">
            <vscode-button
              appearance="icon"
              @click="saveSingleRule(index)"
              :title="dirtyIds.has(rule.id) ? 'Save this rule' : 'Rule saved'"
              aria-label="Save rule"
            >
              <span class="codicon codicon-save"></span>
            </vscode-button>
            <vscode-button
              appearance="icon"
              @click="requestRemoveRule(index)"
              title="Delete rule"
              aria-label="Delete rule"
              class="btn-danger"
            >
              <span class="codicon codicon-trash"></span>
            </vscode-button>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <!-- Footer -->
    <div class="footer-actions">
      <vscode-button appearance="primary" @click="addRule">
        <span slot="start" class="codicon codicon-add"></span>
        Add Rule
      </vscode-button>
      <vscode-button appearance="secondary" @click="emit('importRules')">
        <span slot="start" class="codicon codicon-cloud-upload"></span>
        Import Rules
      </vscode-button>
      <vscode-button appearance="secondary" @click="exportRules">
        <span slot="start" class="codicon codicon-cloud-download"></span>
        Export Rules
      </vscode-button>
      <vscode-button appearance="secondary" @click="emit('scanIacFile')">
        <span slot="start" class="codicon codicon-search"></span>
        Scan IaC File
      </vscode-button>
      <vscode-button
        appearance="secondary"
        @click="confirmRules"
        :disabled="dirtyIds.size === 0 || undefined"
        title="Save all modified rules"
      >
        <span slot="start" class="codicon codicon-save-all"></span>
        Save All
      </vscode-button>
    </div>

    <!-- Toast notifications -->
    <div class="toast-region" aria-live="polite" aria-atomic="false">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast"
          :class="'toast--' + toast.type"
          role="status"
        >
          <span class="codicon" :class="toast.type === 'success' ? 'codicon-check' : 'codicon-error'" aria-hidden="true"></span>
          {{ toast.message }}
        </div>
      </TransitionGroup>
    </div>

    <!-- Delete Confirmation Dialog -->
    <Transition name="dialog">
      <div v-if="ruleToDelete" class="dialog-overlay" role="presentation" @click.self="cancelRemoveRule">
        <div
          class="dialog-content"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          aria-describedby="dialog-description"
        >
          <div class="dialog-icon">
            <span class="codicon codicon-warning" aria-hidden="true"></span>
          </div>
          <h2 id="dialog-title" class="dialog-title">Delete Rule</h2>
          <p id="dialog-description" class="dialog-description">
            Delete pattern <code class="pattern-preview">{{ ruleToDelete.rule.pattern || '(empty)' }}</code>?
            This cannot be undone.
          </p>
          <div class="dialog-actions">
            <vscode-button appearance="secondary" @click="cancelRemoveRule">Cancel</vscode-button>
            <vscode-button appearance="primary" @click="confirmRemoveRule" class="btn-delete-confirm">
              Delete
            </vscode-button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

export interface RuleRow {
  id: string;
  pattern: string;
  replacement: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

const props = defineProps<{
  rules: { id: string; pattern: string; replacement: string }[];
  pendingScannedRules?: { id: string; pattern: string; replacement: string }[];
  pendingImportedRules?: { id: string; pattern: string; replacement: string }[];
}>();

const emit = defineEmits<{
  (e: 'saveRules', rules: { id: string; pattern: string; replacement: string }[]): void;
  (e: 'saveSingleRule', rule: { id: string; pattern: string; replacement: string }): void;
  (e: 'deleteRule', ruleId: string): void;
  (e: 'scanIacFile'): void;
  (e: 'importRules'): void;
  (e: 'exportRules', rules: { id: string; pattern: string; replacement: string }[]): void;
  (e: 'scannedRulesConsumed'): void;
  (e: 'importedRulesConsumed'): void;
}>();

const localRules = ref<RuleRow[]>([]);
const ruleToDelete = ref<{ rule: RuleRow; index: number } | null>(null);
const dirtyIds = ref<Set<string>>(new Set());

// Toast system
const toasts = ref<Toast[]>([]);
let toastCounter = 0;

function showToast(message: string, type: Toast['type'] = 'success') {
  const id = ++toastCounter;
  toasts.value.push({ id, message, type });
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }, 3500);
}

// Merge incoming prop changes, preserving dirty local edits
watch(
  () => props.rules,
  (newRules) => {
    const incoming: RuleRow[] = JSON.parse(JSON.stringify(newRules || []));

    if (localRules.value.length === 0) {
      localRules.value = incoming;
      return;
    }

    const incomingMap = new Map(incoming.map(r => [r.id, r]));

    const merged: RuleRow[] = localRules.value.map(local => {
      if (dirtyIds.value.has(local.id)) return local;
      return incomingMap.get(local.id) ?? local;
    });

    for (const inc of (newRules || [])) {
      if (!merged.find(r => r.id === inc.id)) {
        merged.push(JSON.parse(JSON.stringify(inc)));
      }
    }

    localRules.value = merged;
  },
  { immediate: true, deep: true }
);

// Watch for scanned rules arriving from the IaC scanner
// Only add patterns that don't already exist in localRules (dedup by pattern string)
watch(
  () => props.pendingScannedRules,
  (scanned) => {
    if (!scanned || scanned.length === 0) return;

    const existingPatterns = new Set(
      localRules.value.map(r => r.pattern.trim())
    );

    let addedCount = 0;
    for (const sr of scanned) {
      if (existingPatterns.has(sr.pattern.trim())) continue;
      existingPatterns.add(sr.pattern.trim());
      const newRule: RuleRow = {
        id: sr.id || generateId(),
        pattern: sr.pattern,
        replacement: sr.replacement,
      };
      localRules.value.push(newRule);
      dirtyIds.value = new Set([...dirtyIds.value, newRule.id]);
      addedCount++;
    }

    if (addedCount > 0) {
      showToast(`${addedCount} pattern${addedCount !== 1 ? 's' : ''} added from scan. Save to keep.`);
    } else {
      showToast('All scanned patterns already exist.', 'error');
    }

    emit('scannedRulesConsumed');
  },
  { deep: true }
);

watch(
  () => props.pendingImportedRules,
  (imported) => {
    if (!imported || imported.length === 0) return;

    const existingPatterns = new Set(localRules.value.map(r => r.pattern.trim()));
    let addedCount = 0;

    for (const incoming of imported) {
      if (existingPatterns.has(incoming.pattern.trim())) continue;
      existingPatterns.add(incoming.pattern.trim());
      const newRule: RuleRow = {
        id: incoming.id || generateId(),
        pattern: incoming.pattern,
        replacement: incoming.replacement,
      };
      localRules.value.push(newRule);
      dirtyIds.value = new Set([...dirtyIds.value, newRule.id]);
      addedCount++;
    }

    if (addedCount > 0) {
      showToast(`${addedCount} imported rule${addedCount !== 1 ? 's' : ''} added. Save to keep.`);
    } else {
      showToast('Imported rules are already present.', 'error');
    }

    emit('importedRulesConsumed');
  },
  { deep: true }
);

function generateId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function addRule() {
  const newRule: RuleRow = { id: generateId(), pattern: '', replacement: '' };
  localRules.value.push(newRule);
  // New unsaved rows are marked dirty immediately
  dirtyIds.value = new Set([...dirtyIds.value, newRule.id]);
}

function requestRemoveRule(index: number) {
  const rule = localRules.value[index];
  if (rule) ruleToDelete.value = { rule, index };
}

function confirmRemoveRule() {
  if (ruleToDelete.value !== null) {
    const id = ruleToDelete.value.rule.id;
    localRules.value.splice(ruleToDelete.value.index, 1);
    const next = new Set(dirtyIds.value);
    next.delete(id);
    dirtyIds.value = next;
    ruleToDelete.value = null;
    emit('deleteRule', id);
  }
}

function cancelRemoveRule() {
  ruleToDelete.value = null;
}

function updateRule(index: number, field: 'pattern' | 'replacement', value: string) {
  if (localRules.value[index]) {
    localRules.value[index][field] = value;
    dirtyIds.value = new Set([...dirtyIds.value, localRules.value[index].id]);
  }
}

function saveSingleRule(index: number) {
  const rule = localRules.value[index];
  if (!rule || (rule.pattern.trim() === '' && rule.replacement.trim() === '')) return;

  emit('saveSingleRule', {
    id: rule.id,
    pattern: rule.pattern.trim(),
    replacement: rule.replacement.trim(),
  });

  const next = new Set(dirtyIds.value);
  next.delete(rule.id);
  dirtyIds.value = next;

  showToast('Rule saved.');
}

function confirmRules() {
  const validRules = localRules.value
    .filter(r => r.pattern.trim() !== '' || r.replacement.trim() !== '')
    .map(r => ({ id: r.id, pattern: r.pattern.trim(), replacement: r.replacement.trim() }));

  localRules.value = validRules;
  dirtyIds.value = new Set();

  emit('saveRules', validRules);
  showToast(`${validRules.length} rule${validRules.length !== 1 ? 's' : ''} saved.`);
}

function exportRules() {
  const validRules = localRules.value
    .filter(r => r.pattern.trim() !== '' || r.replacement.trim() !== '')
    .map(r => ({ id: r.id, pattern: r.pattern.trim(), replacement: r.replacement.trim() }));
  emit('exportRules', validRules);
}
</script>

<style scoped>
/* â”€â”€â”€ Layout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.rule-editor-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

/* â”€â”€â”€ Grid wrapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.rules-grid-wrapper {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--vscode-scrollbarSlider-background) transparent;
}

/* â”€â”€â”€ Grid columns: pattern | replacement | 96px actions â”€â”€â”€ */
.grid-header,
.grid-row {
  display: grid;
  grid-template-columns: 1fr 1fr 96px;
  align-items: center;
}

.grid-header {
  padding: 6px 20px;
  background-color: var(--vscode-editorGroupHeader-tabsBackground);
  border-bottom: 1px solid var(--vscode-editorGroup-border);
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vscode-descriptionForeground);
  position: sticky;
  top: 0;
  z-index: 2;
}

.grid-body {
  display: flex;
  flex-direction: column;
}

.grid-row {
  position: relative;
  padding: 5px 20px;
  border-bottom: 1px solid var(--vscode-editorGroup-border);
  gap: 8px;
  transition: background-color 0.15s ease;
}

.grid-row:last-child {
  border-bottom: none;
}

.grid-row:hover {
  background-color: var(--vscode-list-hoverBackground);
}

/* â”€â”€â”€ Dirty state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.dirty-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background-color: var(--vscode-inputValidation-warningBorder, #cca700);
  pointer-events: none;
}

.row-dirty {
  background-color: var(--vscode-inputValidation-warningBackground, rgba(204, 167, 0, 0.04));
}

/* â”€â”€â”€ Column helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.col-pattern,
.col-replacement {
  min-width: 0;
}

.col-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.field-full {
  width: 100%;
  display: block;
}

/* â”€â”€â”€ Danger button (trash) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.btn-danger::part(control) {
  color: var(--vscode-errorForeground);
  opacity: 0.75;
  transition: opacity 0.15s ease;
}
.btn-danger:hover::part(control) {
  opacity: 1;
}

/* â”€â”€â”€ Footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.footer-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-top: 1px solid var(--vscode-editorGroup-border);
  background-color: var(--vscode-editor-background);
  box-shadow: 0 -2px 8px -2px rgba(0, 0, 0, 0.15);
}

/* â”€â”€â”€ Empty state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  gap: 8px;
  text-align: center;
  color: var(--vscode-descriptionForeground);
}

.empty-state .codicon {
  font-size: 32px;
  opacity: 0.35;
  margin-bottom: 4px;
}

.empty-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--vscode-editor-foreground);
  opacity: 0.7;
}

.empty-sub {
  margin: 0;
  font-size: 12px;
  opacity: 0.55;
  max-width: 260px;
  line-height: 1.5;
}

/* â”€â”€â”€ Toast region â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.toast-region {
  position: fixed;
  bottom: 56px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 300;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 500;
  backdrop-filter: blur(6px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  pointer-events: auto;
}

.toast--success {
  background-color: var(--vscode-statusBar-background);
  color: var(--vscode-statusBar-foreground);
  border: 1px solid var(--vscode-statusBar-border, transparent);
}

.toast--error {
  background-color: var(--vscode-inputValidation-errorBackground);
  color: var(--vscode-inputValidation-errorForeground, var(--vscode-errorForeground));
  border: 1px solid var(--vscode-inputValidation-errorBorder);
}

/* â”€â”€â”€ Dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.dialog-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  z-index: 200;
}

.dialog-content {
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  padding: 24px 24px 20px;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
  width: 90%;
  max-width: 380px;
  border: 1px solid var(--vscode-editorGroup-border);
}

.dialog-icon {
  font-size: 22px;
  color: var(--vscode-inputValidation-warningBorder, #cca700);
  margin-bottom: 10px;
}

.dialog-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 10px;
}

.dialog-description {
  margin: 0 0 22px;
  font-size: 13px;
  color: var(--vscode-descriptionForeground);
  line-height: 1.5;
}

.pattern-preview {
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 11px;
  background-color: var(--vscode-textCodeBlock-background);
  padding: 1px 5px;
  border-radius: 3px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-delete-confirm::part(control) {
  background-color: var(--vscode-errorForeground);
  color: #fff;
}

/* â”€â”€â”€ Row enter/leave â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.rule-row-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.rule-row-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
  position: absolute;
  width: 100%;
}
.rule-row-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}
.rule-row-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
.rule-row-move {
  transition: transform 0.2s ease;
}

/* â”€â”€â”€ Toast enter/leave â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.toast-enter-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.96);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(12px) scale(0.96);
}

/* â”€â”€â”€ Empty state fade â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* â”€â”€â”€ Dialog enter/leave â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
.dialog-enter-active {
  transition: opacity 0.2s ease;
}
.dialog-leave-active {
  transition: opacity 0.18s ease;
}
.dialog-enter-from, .dialog-leave-to {
  opacity: 0;
}
.dialog-enter-from .dialog-content,
.dialog-leave-to .dialog-content {
  transform: scale(0.97) translateY(-6px);
}
.dialog-enter-active .dialog-content,
.dialog-leave-active .dialog-content {
  transition: transform 0.2s ease;
}
</style>
