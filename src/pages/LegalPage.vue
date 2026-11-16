<script setup>
// Renderiza termos / privacidade / cookies a partir de data/legal.js (texto em um só lugar).
import { computed } from 'vue'
import { useSeo } from '../composables/useSeo.js'
import { legalDocs } from '../data/legal.js'

const props = defineProps({
  doc: { type: String, required: true }, // terms | privacy | cookies
})

const paths = { terms: '/termos', privacy: '/privacidade', cookies: '/cookies' }
const content = computed(() => legalDocs[props.doc]())

useSeo({
  title: `${content.value.title} | AgendasPro`,
  description: content.value.description,
  path: paths[props.doc],
})
</script>

<template>
  <section class="section" aria-labelledby="legal-h1">
    <div class="container-x max-w-3xl">
      <h1 id="legal-h1" class="text-3xl sm:text-4xl">{{ content.title }}</h1>
      <div class="prose-legal mt-6">
        <template v-for="(b, i) in content.blocks" :key="i">
          <h2 v-if="b.h2">{{ b.h2 }}</h2>
          <h3 v-else-if="b.h3">{{ b.h3 }}</h3>
          <p v-else-if="b.p">{{ b.p }}</p>
          <ul v-else-if="b.ul">
            <li v-for="(li, j) in b.ul" :key="j">{{ li }}</li>
          </ul>
          <div v-else-if="b.table" class="table-scroll" tabindex="0" role="region" aria-label="Tabela (role para o lado para ver todas as colunas)">
            <table>
              <thead>
                <tr><th v-for="h in b.table.head" :key="h" scope="col">{{ h }}</th></tr>
              </thead>
              <tbody>
                <tr v-for="(row, r) in b.table.rows" :key="r">
                  <td v-for="(cell, k) in row" :key="k">{{ cell }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
      <p class="mt-10 text-sm text-[var(--color-ink-soft)]">
        <RouterLink to="/termos" class="underline">Termos de Uso</RouterLink> ·
        <RouterLink to="/privacidade" class="underline">Política de Privacidade</RouterLink> ·
        <RouterLink to="/cookies" class="underline">Política de Cookies</RouterLink>
      </p>
    </div>
  </section>
</template>
