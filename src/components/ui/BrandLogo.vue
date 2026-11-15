<script setup>
defineProps({ light: Boolean })
</script>

<template>
  <span class="inline-flex items-center gap-2 font-bold tracking-tight">
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="#16794a" />
      <rect x="7" y="9" width="18" height="16" rx="3" fill="none" stroke="#fff" stroke-width="2" />
      <path d="M7 14h18M12 6v5M20 6v5" stroke="#fff" stroke-width="2" stroke-linecap="round" />
      <path d="M12.500 19.500l2.500 2.500 4.500-4.500" fill="none" stroke="#7cdf64" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <span class="text-xl" :class="light ? 'text-white' : 'text-ink'">Agendas<span :class="light ? 'text-brand-400' : 'text-brand-600'">Pro</span></span>
  </span>
</template>
