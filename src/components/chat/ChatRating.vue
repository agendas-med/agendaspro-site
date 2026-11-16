<script setup>
// Avaliação da conversa (1 a 5 + comentário opcional). Grupo de rádio acessível (setas, foco visível).
import { ref } from 'vue'

defineProps({
  busy: { type: Boolean, default: false },
  done: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
const emit = defineEmits(['rate'])
const rating = ref(0)
const comment = ref('')
const LABELS = ['Muito ruim', 'Ruim', 'Regular', 'Boa', 'Ótima']
</script>

<template>
  <div class="rounded-xl border border-line bg-white p-3 text-sm">
    <p v-if="done" role="status" class="font-medium">Obrigado pela avaliação!</p>
    <form v-else @submit.prevent="rating && emit('rate', { rating, comment })">
      <fieldset>
        <legend class="font-semibold">Como foi esta conversa?</legend>
        <div class="mt-2 flex gap-1" role="radiogroup" aria-label="Nota de 1 a 5">
          <label
            v-for="n in 5"
            :key="n"
            class="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border text-base font-semibold focus-within:ring-2 focus-within:ring-brand-600"
            :class="rating === n ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-ink hover:border-brand-600'"
          >
            <input v-model="rating" type="radio" name="chat-rating" :value="n" class="absolute inset-0 cursor-pointer opacity-0" :aria-label="`${n} - ${LABELS[n - 1]}`" />
            <span aria-hidden="true">{{ n }}</span>
          </label>
        </div>
      </fieldset>
      <label for="chat-rating-comment" class="field-label mt-3">Comentário (opcional)</label>
      <textarea id="chat-rating-comment" v-model="comment" class="field" rows="2" maxlength="500" />
      <p v-if="error" class="field-error" role="alert">{{ error }}</p>
      <button type="submit" class="btn btn-primary mt-2 w-full" :disabled="!rating || busy" :aria-busy="busy">{{ busy ? 'Enviando…' : 'Enviar avaliação' }}</button>
    </form>
  </div>
</template>
