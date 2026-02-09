// Example: Menu.vue
<template>
  <div class="w-64 bg-white shadow rounded p-4">
    <h3 class="text-lg font-semibold mb-4">Menu</h3>
    <ul>
      <li v-for="item in menuItems" :key="item.label" class="mb-2">
        <button
          class="w-full text-left px-3 py-2 rounded hover:bg-blue-100 transition"
          @click="selectItem(item)"
        >
          <span :class="item.selected ? 'font-bold text-blue-600' : ''">{{ item.label }}</span>
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