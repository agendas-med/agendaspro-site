<script setup>
// Link seguro do chat: o href JÁ passou por safeHref (esquema + host na allowlist). Interno usa o router.
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { isExternalHref } from '../../lib/chatText.js'

const props = defineProps({
  href: { type: String, required: true },
  ownHosts: { type: Array, default: () => [] },
})
const internal = computed(() => props.href.startsWith('/'))
const external = computed(() => isExternalHref(props.href, props.ownHosts))
</script>

<template>
  <RouterLink v-if="internal" :to="href"><slot /></RouterLink>
  <a v-else :href="href" :target="external ? '_blank' : undefined" rel="noopener noreferrer"><slot /></a>
</template>
