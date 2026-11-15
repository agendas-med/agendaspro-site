<script setup>
defineEmits(['select'])
</script>

<template>
  <fieldset>
    <legend class="mb-3 text-base font-semibold">Você é:</legend>
    <div class="space-y-2">
      <button
        type="button"
        class="w-full rounded-xl border border-line p-3 text-left text-sm font-medium hover:border-brand-600 hover:bg-brand-50"
        @click="$emit('select', 'customer')"
      >
        Cliente procurando agendamento
      </button>
      <button
        type="button"
        class="w-full rounded-xl border border-line p-3 text-left text-sm font-medium hover:border-brand-600 hover:bg-brand-50"
        @click="$emit('select', 'business')"
      >
        Empresa interessada
      </button>
    </div>
  </fieldset>
</template>
