# agendaspro-site

Site institucional e página pública de agendamento do **AgendasPro**, SaaS de agenda online para negócios de serviços (clínicas, estética, barbearia/salão, odontologia, psicologia, pet, fisioterapia).

Stack: Vue 3 + Vue Router + Vite 6 + Tailwind 4 + `@unhead/vue`. Testes com Vitest.

## Páginas

| Rota | Conteúdo | Entrega |
| --- | --- | --- |
| `/`, `/precos`, `/recursos`, `/integracoes`, `/para/:nicho`, `/contato`, `/termos`, `/privacidade`, `/cookies` | Marketing e legal | HTML pré-renderizado no build (SSG) |
| `/b/:slug` | Página pública de agendamento do cliente do AgendasPro | SPA (shell `/spa/index.html`) |
| `/agendamento/:token` | Ver, remarcar e cancelar um agendamento | SPA (noindex) |
| qualquer outra | 404 real (`404.html`, status 404) | estático |

## Rodar

```sh
npm install
cp .env.example .env.local     # ajuste os valores
npm run dev                    # http://localhost:5173
npm test                       # Vitest
npm run build                  # vite build + bundle SSR + prerender (dist/)
npm run serve:dist             # serve dist/ com as regras de rewrite/404 do deploy
```

### Modo mock (sem backend)

Com `VITE_USE_MOCKS=true` a UI usa `src/services/mockApi.js`. Slugs de exemplo: `clinica-exemplo` (sinal por Pix) e `barbearia-exemplo` (sem sinal). O nome do cliente aciona cenários: `conflito` (409 slot_taken), `limite` (429), `erro` (500), `rede` (falha de rede), `expira` (Pix que vence em 25 s). O Pix mock é "pago" após cerca de 12 s. Em build de produção sem `VITE_USE_MOCKS=true` o mock não entra no bundle.

## Variáveis de ambiente

Veja `.env.example` (apenas nomes e exemplos; valores reais nunca são versionados). Todas são públicas no bundle.

- `VITE_APP_URL`: destino dos CTAs `/registro` e `/entrar` (painel `agendaspro-system`).
- `VITE_API_BASE`: base da API do core (rotas `/public/*`). O mesmo host deve estar em `connect-src` do CSP.
- `VITE_TURNSTILE_SITE_KEY`: Cloudflare Turnstile (formulário de lead e agendamento).
- `VITE_WHATSAPP_NUMBER`: botão de WhatsApp (`wa.me`); vazio oculta o botão.
- `VITE_GA4_ID`, `VITE_META_PIXEL_ID`, `VITE_CLARITY_ID`: analytics, carregados só após consentimento.
- `VITE_CHAT_ENABLED`: chat com IA (placeholder, `false` por padrão).

## Contratos com o core (`/public/*`)

Definidos em `LAUNCH-PLAN.md`: `POST /public/leads`, `GET /public/b/:slug`, `GET /public/b/:slug/availability`, `POST /public/b/:slug/bookings`. Erros no formato `{error:{code,message}}`.

**Assumidos (a confirmar no core):** `GET /public/bookings/:token`, `POST /public/bookings/:token/cancel` e `POST /public/bookings/:token/reschedule`. O formato esperado está em `src/services/mockApi.js`. O Pix da página de agendamento usa o `GET` para consultar o status (polling a cada 5 s).

## Dados que o dono precisa preencher

- `src/config/company.js`: `[RAZÃO SOCIAL]`, `[CNPJ]`, `[ENDEREÇO]`, `[EMAIL_DPO]` e e-mail de suporte. Os textos legais (`src/data/legal.js`) são **modelo a ser revisado por advogado** e usam esses campos.
- Depoimentos (`src/data/socialProof.js`) são exemplos ilustrativos (`isPlaceholder`); troque por clientes reais com autorização.
- Preços e limites dos planos: `src/data/plans.js`.

## SEO e deploy

- `npm run build` gera `dist/` com HTML por rota, `sitemap.xml` e `robots.txt` (só rotas estáticas), `404.html` e `spa/index.html`.
- Rewrites: `/b/*` e `/agendamento/*` para `/spa/index.html` (status 200). Configurados em `public/_redirects` (Netlify/Cloudflare Pages), `netlify.toml` e `vercel.json`.
- Headers de segurança e CSP: `public/_headers` e `vercel.json` (mantenha os dois em sincronia). Troque `https://api.agendaspro.com.br` pelo host de `VITE_API_BASE`.
- A imagem de compartilhamento é `public/og-image.png` (1200x630).
- Analytics: nenhum script de terceiros carrega antes do consentimento (`localStorage` `ap_consent_v1`). Eventos: `generate_lead`, `sign_up_click`, `whatsapp_click`, `booking_confirmed`.

## Estrutura

```
src/
  app.js, entry-client.js, entry-server.js   # app universal (SSG + hidratação)
  routes/routes.js
  pages/                                     # uma por rota
  components/{ui,layout,forms,mocks,booking,chat}/
  services/{publicApi,apiError,mockApi,analytics}.js
  lib/{phone,commission,datetime,sitemap}.js # funções puras (com testes)
  data/{plans,features,niches,faq,legal,socialProof}.js
  config/{env,company}.js
scripts/{prerender,serve-dist}.mjs
```
