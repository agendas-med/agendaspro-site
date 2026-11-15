<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { niches } from '../../data/niches.js'
import BrandLogo from '../ui/BrandLogo.vue'
import AppIcon from '../ui/AppIcon.vue'
import SignupLink from '../ui/SignupLink.vue'

const route = useRoute()
const menuOpen = ref(false)
const nichesOpen = ref(false)
const menuButton = ref(null)
const nichesButton = ref(null)
const nichesWrap = ref(null)

const links = [
  { to: '/recursos', label: 'Recursos' },
  { to: '/integracoes', label: 'Integrações' },
  { to: '/precos', label: 'Preços' },
  { to: '/contato', label: 'Contato' },
]

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
    nichesOpen.value = false
  },
)

watch(menuOpen, (v) => {
  if (typeof document !== 'undefined') document.body.style.overflow = v ? 'hidden' : ''
})

function onKeydown(e) {
  if (e.key !== 'Escape') return
  if (menuOpen.value) {
    menuOpen.value = false
    nextTick(() => menuButton.value?.focus())
  } else if (nichesOpen.value) {
    nichesOpen.value = false
    nextTick(() => nichesButton.value?.focus())
  }
}
function onDocClick(e) {
  if (nichesOpen.value && nichesWrap.value && !nichesWrap.value.contains(e.target)) nichesOpen.value = false
}
onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('click', onDocClick)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('click', onDocClick)
  document.body.style.overflow = ''
})
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
    <div class="container-x flex h-16 items-center justify-between gap-4">
      <RouterLink to="/" aria-label="AgendasPro, página inicial" class="shrink-0">
        <BrandLogo />
      </RouterLink>

      <nav aria-label="Principal" class="hidden items-center gap-1 lg:flex">
        <div ref="nichesWrap" class="relative">
          <button
            ref="nichesButton"
            type="button"
            class="flex items-center gap-1 rounded-lg px-3 py-2 text-[0.9375rem] font-medium text-ink-soft hover:text-ink"
            :aria-expanded="nichesOpen"
            aria-controls="menu-nichos"
            @click="nichesOpen = !nichesOpen"
          >
            Para quem
            <AppIcon name="chevron" :size="16" />
          </button>
          <ul
            v-show="nichesOpen"
            id="menu-nichos"
            class="absolute left-0 top-full mt-2 w-64 rounded-xl border border-line bg-white p-2 shadow-pop"
          >
            <li v-for="n in niches" :key="n.slug">
              <RouterLink
                :to="`/para/${n.slug}`"
                class="block rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50"
              >
                {{ n.short }}
              </RouterLink>
            </li>
          </ul>
        </div>
        <RouterLink
          v-for="l in links"
          :key="l.to"
          :to="l.to"
          class="rounded-lg px-3 py-2 text-[0.9375rem] font-medium text-ink-soft hover:text-ink"
          active-class="!text-brand-700"
        >
          {{ l.label }}
        </RouterLink>
      </nav>

      <div class="hidden items-center gap-2 lg:flex">
        <SignupLink to="/entrar" variant="outline" location="header">Entrar</SignupLink>
        <SignupLink location="header">Começar grátis</SignupLink>
      </div>

      <button
        ref="menuButton"
        type="button"
        class="flex h-11 w-11 items-center justify-center rounded-lg border border-line lg:hidden"
        :aria-expanded="menuOpen"
        aria-controls="menu-mobile"
        :aria-label="menuOpen ? 'Fechar menu' : 'Abrir menu'"
        @click="menuOpen = !menuOpen"
      >
        <AppIcon :name="menuOpen ? 'x' : 'menu'" />
      </button>
    </div>

    <nav
      v-show="menuOpen"
      id="menu-mobile"
      aria-label="Menu móvel"
      class="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line bg-white lg:hidden"
    >
      <div class="container-x flex flex-col gap-1 py-4">
        <p class="px-3 pt-1 text-xs font-semibold uppercase tracking-wider text-ink-soft">Para quem</p>
        <RouterLink
          v-for="n in niches"
          :key="n.slug"
          :to="`/para/${n.slug}`"
          class="rounded-lg px-3 py-2.5 font-medium hover:bg-brand-50"
        >
          {{ n.short }}
        </RouterLink>
        <hr class="my-2 border-line" />
        <RouterLink v-for="l in links" :key="l.to" :to="l.to" class="rounded-lg px-3 py-2.5 font-medium hover:bg-brand-50">
          {{ l.label }}
        </RouterLink>
        <div class="mt-3 grid grid-cols-2 gap-3">
          <SignupLink to="/entrar" variant="outline" location="menu-mobile">Entrar</SignupLink>
          <SignupLink location="menu-mobile">Começar grátis</SignupLink>
        </div>
      </div>
    </nav>
  </header>
</template>
