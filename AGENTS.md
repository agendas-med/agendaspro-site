# agendaspro-site

Site de marketing (B2B) + página pública de agendamento do AgendasPro. Vue 3 + Vite + Tailwind 4 + @unhead/vue. Detalhes: `README.md`.

Scripts: `dev`, `build` (vite build + SSR + prerender), `preview`, `serve:dist`, `test` (Vitest).

## Regras comuns

- `.env*` nunca é lido, impresso nem commitado (nomes das variáveis: `.env.example`).
- Sem `git push`/deploy sem pedido; commits com caminhos explícitos (nada de `git add .`).
- Só anunciar recursos que estão no `LAUNCH-PLAN.md`; o que não está pronto leva "Em breve".
- Placeholders legais (`[RAZÃO SOCIAL]`, `[CNPJ]`, ...) ficam só em `src/config/company.js`; o texto legal é modelo a revisar por advogado.
- Endpoints `/public/bookings/:token*` são assumidos (ver `src/services/mockApi.js`) até o core publicar o contrato.
