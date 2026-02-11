// Example: Menu.vue
<template>
  <div class="w-72 bg-gradient-to-br from-blue-50 via-white to-blue-100 shadow-xl rounded-xl p-6">
    <h3 class="text-2xl font-bold mb-6 text-blue-700">Prompt Hider Menu</h3>
    <ul>
      <li v-for="item in menuItems" :key="item.label" class="mb-3">
        <button
          class="w-full flex items-center px-4 py-3 rounded-lg transition 
                 bg-white hover:bg-blue-200 hover:text-blue-900 
                 shadow-sm border border-blue-100
                 font-medium text-lg"
          :class="item.selected ? 'bg-blue-500 text-white font-bold border-blue-500 shadow-md' : ''"
          @click="selectItem(item)"
        >
          <span class="mr-2">
            <svg v-if="item.selected" class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          {{ item.label }}
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const menuItems = ref([
  { label: 'Rules', selected: false },
  { label: 'Create Rule', selected: false },
  { label: 'Edit Rule', selected: false },
  { label: 'Enable/Disable', selected: false },
]);

function selectItem(item: any) {
  menuItems.value.forEach(i => i.selected = false);
  item.selected = true;
}
</script>