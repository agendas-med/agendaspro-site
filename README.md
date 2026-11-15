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

Com `VITE_USE_MOCK=true` (**só em dev/teste**) a UI usa `src/services/mockApi.js`, que simula o contrato do core (ids string, `payment`, `policy`, idempotência, vencimento do Pix na leitura). Slugs: `clinica-exemplo` (sinal por Pix) e `barbearia-exemplo` (sem sinal). O nome do cliente aciona cenários: `conflito` (409 slot_taken), `limite` (429), `erro` (500), `rede`, `pagamento` (503 payment_unavailable), `indisponivel` (503 service_unavailable), `grande` (413), `expira` (Pix que vence em 25 s), `janela` (cancel_window_closed) e `linkvencido` (410 token_expired). O Pix mock é "pago" após cerca de 12 s. O mock só entra no bundle via `import()` atrás de `import.meta.env.DEV` (fora do build de produção) e o build de produção ABORTA se `VITE_USE_MOCK` ou `VITE_TURNSTILE_DEV_BYPASS` estiver `true`.

## Variáveis de ambiente

Veja `.env.example` (apenas nomes e exemplos; valores reais nunca são versionados). Todas são públicas no bundle.

- `VITE_APP_URL`: destino dos CTAs `/registro` e `/entrar` (painel `agendaspro-system`).
- `VITE_API_BASE`: base da API do core (rotas `/public/*`), ex.: `https://SEU-APP.herokuapp.com`. O mesmo host deve estar em `connect-src` do CSP (`public/_headers` e `vercel.json`, hoje com o placeholder `https://api.agendaspro.com.br`); o prerender falha se não estiver.
- `VITE_TURNSTILE_SITE_KEY`: Cloudflare Turnstile (lead e agendamento). Obrigatória em produção: sem ela o envio fica bloqueado com aviso visível. Em dev sem chave, `VITE_TURNSTILE_DEV_BYPASS=true` (ou mock) envia o token fixo de bypass (o core precisa estar com `TURNSTILE_ENABLED=false` e `TURNSTILE_DEV_BYPASS=true`).
- `VITE_WHATSAPP_NUMBER`: botão de WhatsApp (`wa.me`); vazio oculta o botão.
- `VITE_GA4_ID`, `VITE_META_PIXEL_ID`, `VITE_CLARITY_ID`: analytics, carregados só após consentimento.
- `VITE_CHAT_ENABLED`: chat com IA (placeholder, `false` por padrão).

## Contratos com o core (`/public/*`)

Definidos em `LAUNCH-PLAN.md`: `POST /public/leads`, `GET /public/b/:slug`, `GET /public/b/:slug/availability`, `POST /public/b/:slug/bookings`. Erros no formato `{error:{code,message}}`.

Contrato completo (erros por código, token de gestão, `payment`, `policy`, idempotência, limites) em `agendaspro-core/docs/contratos-f3.md`. Gestão por token: `GET /public/bookings/:token`, `POST .../cancel`, `POST .../reschedule`. O Pix da página consulta o `GET` do token (polling leve: 5 s, 5 s, 10 s e depois 15 s; pausa com a aba oculta; recua em 429).

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
