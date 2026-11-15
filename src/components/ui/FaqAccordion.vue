<script setup>
// Acordeão acessível: botão com aria-expanded/aria-controls; o conteúdo permanece no HTML (SEO).
import { ref } from 'vue'
import AppIcon from './AppIcon.vue'

defineProps({
  items: { type: Array, required: true }, // [{q, a}]
  idPrefix: { type: String, default: 'faq' },
})

const open = ref(new Set())
const toggle = (i) => {
  const next = new Set(open.value)
  next.has(i) ? next.delete(i) : next.add(i)
  open.value = next
}
</script>

<template>
  <div class="divide-y divide-[var(--color-line)] rounded-2xl border border-[var(--color-line)] bg-white">
    <div v-for="(item, i) in items" :key="i">
      <h3 class="!text-base !font-semibold !tracking-normal">
        <button
          type="button"
          class="flex min-h-[3.25rem] w-full items-center justify-between gap-4 px-5 py-4 text-left"
          :aria-expanded="open.has(i)"
          :aria-controls="`${idPrefix}-panel-${i}`"
          :id="`${idPrefix}-btn-${i}`"
          @click="toggle(i)"
        >
          <span>{{ item.q }}</span>
          <span class="shrink-0 transition-transform" :class="open.has(i) && 'rotate-180'">
            <AppIcon name="chevron" :size="20" />
          </span>
        </button>
      </h3>
      <div
        :id="`${idPrefix}-panel-${i}`"
        role="region"
        :aria-labelledby="`${idPrefix}-btn-${i}`"
        v-show="open.has(i)"
        class="px-5 pb-5 text-[var(--color-ink-soft)]"
      >
        {{ item.a }}
      </div>
    </div>
  </div>
</template>
