<template>
  <div class="min-h-screen flex flex-col items-center justify-center px-6 py-10 menu-bg">
    <h1 class="text-3xl font-extrabold italic mb-12 text-white tracking-tight text-center">
      Prompt Hider Menu &ndash; [{{ rulesheetName }}]
    </h1>

    <div class="flex flex-col gap-5 w-72">
      <!-- View Rules -->
      <button
        @click="$emit('navigate', 'rules')"
        class="menu-btn menu-btn-primary"
      >
        View Rules
      </button>

      <!-- Option 2 (placeholder) -->
      <button class="menu-btn menu-btn-default" disabled>
        Option 2
      </button>

      <!-- Option 3 (placeholder) -->
      <button class="menu-btn menu-btn-default" disabled>
        Option 3
      </button>

      <!-- Enable / Disable toggle -->
      <button
        @click="$emit('toggleEnabled')"
        class="menu-btn menu-btn-default"
      >
        Enable:&nbsp;
        <span
          :class="enabled ? 'text-green-600' : 'text-red-500'"
          class="font-bold"
        >
          {{ enabled ? 'TRUE' : 'FALSE' }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  rulesheetName: string;
  enabled: boolean;
}>();

defineEmits<{
  (e: 'navigate', view: string): void;
  (e: 'toggleEnabled'): void;
}>();
</script>

<style scoped>
.menu-bg {
  background: linear-gradient(135deg, #252525 0%, #302f2f 50%, #252525 100%)
}

.menu-btn {
  background: white;
  @apply w-full px-6 py-4 rounded-full text-lg font-semibold shadow-md
         transition-all duration-200 cursor-pointer select-none
         border focus:outline-none focus:ring-2 focus:ring-green-300;
}

.menu-btn-primary {
  @apply text-gray-800 border-green-200 hover:shadow-lg hover:scale-[1.02];
}

.menu-btn-default {
  @apply bg-white text-gray-700 border-gray-200
         hover:bg-gray-50 hover:shadow-lg hover:scale-[1.02]
         disabled:opacity-60 disabled:cursor-default disabled:hover:scale-100 disabled:hover:shadow-md;
}
</style>
