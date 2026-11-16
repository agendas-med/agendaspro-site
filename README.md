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
- `VITE_CHAT_ENABLED`: liga o chat com IA (`false` por padrão). Ver "Chat com IA" abaixo.
- `VITE_CHAT_LINK_HOSTS`: hosts extras (CSV) aceitos nos links das respostas da IA.

## Chat com IA (texto)

Widget flutuante (`src/components/chat/`), em todas as páginas do site e em `/b/:slug` (aí envia `company_slug` e a audiência "cliente"). Contrato do core: `agendaspro-core/docs/contratos-f5a.md`. Sem voz.

- **Liga/desliga**: `VITE_CHAT_ENABLED=true` no build do site **e** `PUBLIC_CHAT_ENABLED=true` no core. Se o core responder `503 chat_disabled`, o widget se esconde na sessão (sessionStorage). Com a flag `false` nada do chat entra na página.
- **Carga**: só o botão (leve) está no bundle inicial; o painel é um chunk separado (`ChatPanel-*.js`) baixado ao abrir. O prerender não gera marcação do chat (nada de SSR/hidratação extra).
- **Fluxo**: o painel pergunta primeiro se a pessoa é cliente ou dona de negócio; só depois cria a sessão (`POST /public/chat/session`) com Turnstile real (dev: `VITE_TURNSTILE_DEV_BYPASS=true`). O token `cs1.*` fica só em memória e `sessionStorage` (nunca `localStorage`, nunca na URL) e as mensagens não são persistidas. Sessão expirada ou bloqueada encerra a conversa; nunca recria sessão sozinho.
- **Mensagens**: SSE com fallback para JSON, `client_msg_id` para idempotência (reenvio reusa o id), debounce/anti duplo clique, estados de digitando/erro/tentar de novo. Tratados: 429 (com `Retry-After`), 413, 503, `degraded`, sessão encerrada/bloqueada, limites de mensagens/tokens (mostrados com discrição). `suggestions` e `proactive_hint` viram chips/CTAs. Lead (só audiência empresa) com consentimento LGPD; nota e encerramento da conversa.
- **Segurança**: respostas renderizadas como texto seguro por um parser próprio (`src/lib/chatText.js`), sem `v-html`; links só para hosts da allowlist (`src/lib/chatLinks.js`; `http:` só para localhost em dev). Aviso visível: "Assistente de IA, pode errar; não substitui atendimento humano" + link da política de privacidade.
- **CSP**: sem mudança; o `connect-src` do host da API (já exigido) cobre o chat, e o Turnstile já está em `script-src`/`frame-src`. `public/_headers` e `vercel.json` continuam idênticos.
- **Dev/mock**: com `VITE_USE_MOCK=true` o chat usa `src/services/mockChat.js` (só via `import()` atrás de `import.meta.env.DEV`; não vai para o bundle de produção). Palavras que acionam cenários: `429`, `rapido`, `pausa`, `erro`, `lento`, `expirar`, `bloquear`, `limite`, `degradar`, `planos`, `horarios`.

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

### Deploy em produção

Site estático (`dist/`), sem servidor. O provedor builda a partir do repositório; não há deploy pelo CI.

- **Provedor**: Cloudflare Pages (recomendado, plano gratuito permite uso comercial) ou Netlify. Vercel Hobby proíbe uso comercial; use só no plano Pro. Build: `npm run build`, saída `dist`, Node 24 (`engines`, `netlify.toml`; no Cloudflare Pages defina `NODE_VERSION=24`).
- **Variáveis no provedor** (escopo produção): `VITE_SITE_URL`, `VITE_APP_URL`, `VITE_API_BASE` (host do core), `VITE_TURNSTILE_SITE_KEY`, `VITE_CHAT_ENABLED`, `VITE_WHATSAPP_NUMBER` e analytics opcionais. Nunca defina `VITE_USE_MOCK` nem `VITE_TURNSTILE_DEV_BYPASS` como `true`: o build aborta. São valores públicos (vão no bundle); nada de segredo aqui.
- **CSP**: antes do primeiro deploy, troque `https://api.agendaspro.com.br` em `public/_headers` e `vercel.json` pelo host real de `VITE_API_BASE` (os dois arquivos precisam ficar idênticos; há teste para isso e o prerender falha se o host não estiver em `connect-src`).
- **Domínio**: aponte o domínio (ex.: `agendaspro.com.br`) no provedor com HTTPS; `VITE_SITE_URL` deve ser exatamente essa origem (canonical, sitemap, OG). No core, inclua a origem do site em `PUBLIC_CORS_ORIGINS` (rotas `/public/*`) e use-a em `PUBLIC_SITE_URL`.
- **Checagem pós-deploy**: abrir `/`, `/precos` e uma `/b/<slug>` real; conferir no DevTools que não há erro de CSP e que `POST /public/leads` chega ao core.
- **CI** (`.github/workflows/ci.yml`): lint, testes e build de produção com flags falsas; falha se o bundle tiver `VITE_USE_MOCK`/`VITE_TURNSTILE_DEV_BYPASS` como `"true"`.

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
