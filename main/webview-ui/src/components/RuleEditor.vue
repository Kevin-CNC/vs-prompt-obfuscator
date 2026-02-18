<template>
  <div class="min-h-screen flex flex-col items-center px-4 py-8 editor-bg">
    <!-- Title -->
    <h1 class="text-3xl font-extrabold italic mb-6 text-gray-800 tracking-tight text-center">
      [{{ rulesheetName }}]
    </h1>

    <!-- Back button -->
    <button
      @click="$emit('back')"
      class="absolute top-3 left-3 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200
              flex items-center justify-center text-lg text-gray-600 shadow-sm z-10
              transition-colors cursor-pointer focus:outline-none"
      title="Back to menu"
    >
      &lt;
    </button>

    <!-- Card -->
    <div class="w-full max-w-3xl bg-white rounded-2xl shadow-lg overflow-hidden relative">

      <!-- Table header -->
      <div class="grid grid-cols-2 border-b border-gray-300 pt-3 pb-2 px-14">
        <div class="text-center font-semibold text-gray-700 text-base">Pattern to censor</div>
        <div class="text-center font-semibold text-gray-700 text-base">Output</div>
      </div>

      <!-- Rules list -->
      <div>
        <div
          v-for="(rule, index) in localRules"
          :key="rule.id"
          class="grid grid-cols-2 border-b border-gray-100"
          :class="index % 2 === 0 ? 'bg-white' : 'bg-gray-100'"
        >
          <!-- Pattern cell -->
          <div class="relative flex items-center justify-center px-6 py-4 min-h-[56px]">
            <!-- Edit mode -->
            <input
              v-if="rule.editing"
              v-model="rule.pattern"
              class="w-full text-center text-red-600 italic font-medium bg-transparent
                     border-b-2 border-gray-300 focus:border-red-400 outline-none py-1 text-sm"
              placeholder="Enter pattern..."
              @keydown.enter="finishEdit(index)"
            />
            <!-- Display mode -->
            <span v-else class="text-red-600 italic font-medium text-sm text-center break-all">
              {{ rule.pattern }}
            </span>

            <!-- Cell action buttons -->
            <div v-if="!rule.editing" class="absolute top-1 right-1 flex gap-1">
              <button
                @click="removeRule(index)"
                class="action-btn action-btn-delete"
                title="Delete rule"
              >✕</button>
              <button
                @click="startEdit(index)"
                class="action-btn action-btn-edit"
                title="Edit rule"
              >✎</button>
            </div>
          </div>

          <!-- Divider -->
          <div class="relative flex items-center justify-center px-6 py-4 min-h-[56px] border-l border-gray-200">
            <!-- Edit mode -->
            <input
              v-if="rule.editing"
              v-model="rule.replacement"
              class="w-full text-center text-gray-900 font-semibold bg-transparent
                     border-b-2 border-gray-300 focus:border-blue-400 outline-none py-1 text-sm"
              placeholder="Enter output..."
              @keydown.enter="finishEdit(index)"
            />
            <!-- Display mode -->
            <span v-else class="text-gray-900 font-semibold text-sm text-center break-all">
              {{ rule.replacement }}
            </span>

            <!-- Cell action buttons -->
            <div v-if="!rule.editing" class="absolute top-1 right-1 flex gap-1">
              <button
                @click="removeRule(index)"
                class="action-btn action-btn-delete"
                title="Delete rule"
              >✕</button>
              <button
                @click="startEdit(index)"
                class="action-btn action-btn-edit"
                title="Edit rule"
              >✎</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Add button row -->
      <div class="flex justify-center py-4 bg-gray-50 border-t border-gray-100">
        <button
          @click="addRule"
          class="w-10 h-10 rounded-full bg-white hover:bg-green-50
                 border-2 border-gray-300 hover:border-green-400
                 flex items-center justify-center text-2xl text-gray-500 hover:text-green-600
                 shadow-sm transition-all cursor-pointer focus:outline-none"
          title="Add new rule"
        >
          +
        </button>
      </div>
    </div>

    <!-- Confirm button -->
    <div class="flex justify-end w-full max-w-3xl mt-5">
      <button
        @click="confirmRules"
        class="px-6 py-3 rounded-xl bg-white hover:bg-green-50 text-gray-700 font-semibold
               shadow-md border border-gray-200 hover:border-green-400
               transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-300"
      >
        Confirm?
      </button>
    </div>

    <!-- Save feedback -->
    <transition name="fade">
      <div
        v-if="showSaved"
        class="fixed bottom-6 right-6 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium"
      >
        Rules saved successfully!
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

export interface RuleRow {
  id: string;
  pattern: string;
  replacement: string;
  editing: boolean;
}

const props = defineProps<{
  rulesheetName: string;
  rules: { id: string; pattern: string; replacement: string }[];
}>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'saveRules', rules: { id: string; pattern: string; replacement: string }[]): void;
}>();

const localRules = ref<RuleRow[]>([]);
const showSaved = ref(false);

// Sync props → local state when rules change
watch(
  () => props.rules,
  (newRules) => {
    localRules.value = newRules.map((r) => ({
      id: r.id,
      pattern: r.pattern,
      replacement: r.replacement,
      editing: false,
    }));
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
    editing: true,
  });
}

function removeRule(index: number) {
  localRules.value.splice(index, 1);
}

function startEdit(index: number) {
  localRules.value[index].editing = true;
}

function finishEdit(index: number) {
  localRules.value[index].editing = false;
}

function confirmRules() {
  // Filter out incomplete rows (both fields must be filled)
  const validRules = localRules.value
    .filter((r) => r.pattern.trim() !== '' && r.replacement.trim() !== '')
    .map((r) => ({
      id: r.id,
      pattern: r.pattern.trim(),
      replacement: r.replacement.trim(),
    }));

  // Finish editing on all rows
  localRules.value.forEach((r) => (r.editing = false));

  // Remove incomplete rows from local display
  localRules.value = localRules.value.filter(
    (r) => r.pattern.trim() !== '' && r.replacement.trim() !== ''
  );

  emit('saveRules', validRules);

  // Show success toast
  showSaved.value = true;
  setTimeout(() => {
    showSaved.value = false;
  }, 2500);
}
</script>

<style scoped>
.editor-bg {
  background: #202020;
}

.action-btn {
  @apply w-6 h-6 rounded-full text-xs flex items-center justify-center shadow-sm
         cursor-pointer transition-colors focus:outline-none;
}

.action-btn-delete {
  @apply bg-red-100 hover:bg-red-200 text-red-500;
}

.action-btn-edit {
  @apply bg-gray-200 hover:bg-gray-300 text-gray-600;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
