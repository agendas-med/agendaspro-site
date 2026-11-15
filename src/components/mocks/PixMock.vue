<script setup>
// Ilustração (QR fictício, não pagável) do Pix de sinal no agendamento. Decorativa.
const cells = []
for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if ((x * 7 + y * 13 + x * y) % 3 === 0) cells.push([x, y])
</script>

<template>
  <div class="card mx-auto w-full max-w-[17rem] p-4 text-center text-[13px]" role="img" aria-label="Ilustração de um QR Code Pix para pagar o sinal do agendamento">
    <p class="font-semibold">Pague o sinal para garantir o horário</p>
    <svg viewBox="-1 -1 11 11" class="mx-auto my-3 h-32 w-32 rounded-lg border border-[var(--color-line)]" aria-hidden="true">
      <rect x="-1" y="-1" width="11" height="11" fill="#fff" />
      <rect v-for="c in cells" :key="c.join()" :x="c[0]" :y="c[1]" width="1" height="1" fill="#10243a" />
    </svg>
    <p class="rounded-lg bg-slate-100 px-2 py-1.5 font-mono text-[11px] text-[var(--color-ink-soft)]">Pix copia e cola</p>
    <p class="mt-2 text-[var(--color-ink-soft)]">Confirmação automática após o pagamento</p>
  </div>
</template>
