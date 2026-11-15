// Fonte única da matriz de planos (espelha o LAUNCH-PLAN). Comissões em pontos-base (bps).
// O preço do Premium é configurável por VITE_PLAN_PREMIUM_PRICE_CENTS (default 4990) até o dono confirmar.
import { env } from '../config/env.js'
import { FREE_BPS, PREMIUM_BPS } from '../lib/commission.js'

export const plans = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Para começar a organizar a agenda sem custo fixo.',
    priceCents: 0,
    commissionBps: FREE_BPS,
    commissionLabel: '5%',
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    tagline: 'Para quem quer crescer com equipe, mais automação e a menor comissão.',
    priceCents: env.premiumPriceCents,
    commissionBps: PREMIUM_BPS,
    commissionLabel: '0,5%',
  },
}

/** Linhas da tabela comparativa. `soon` marca o que ainda não foi liberado. */
export const planMatrix = [
  { label: 'Mensalidade', free: 'R$ 0', premium: 'R$ 49,90/mês' },
  { label: 'Comissão sobre venda online (sinal/pagamento)', free: '5%', premium: '0,5%' },
  { label: 'Profissionais', free: '1', premium: 'Ilimitados' },
  { label: 'Usuários da equipe', free: '2', premium: 'Ilimitados' },
  {
    label: 'Página pública de agendamento (link e QR Code)',
    free: 'Sim, com o rodapé “Feito com AgendasPro”',
    premium: 'Sim, sem marca e com a cor do seu negócio',
  },
  {
    label: 'Lembretes e confirmação no WhatsApp',
    free: 'Confirmação + lembrete 24h, até 50 mensagens/mês',
    premium: '24h + 2h antes, pós-atendimento e aniversário (uso justo)',
  },
  { label: 'Cobrança de sinal por Pix no agendamento', free: true, premium: true },
  {
    label: 'Lista de espera, reativação de inativos e NPS com pedido de avaliação no Google',
    free: false,
    premium: true,
    soon: true,
  },
  {
    label: 'Dashboard do Instagram (métricas, posts, engajamento e conversão)',
    free: 'Somente o link do perfil',
    premium: true,
    soon: true,
  },
  { label: 'Sincronização com o Google Agenda', free: false, premium: true, soon: true },
  {
    label: 'Assistente de IA no painel',
    free: '30 interações/mês (consulta)',
    premium: '1.000/mês, com ações após sua confirmação',
    soon: true,
  },
  { label: 'Relatórios', free: 'Básicos', premium: 'Avançados + exportação CSV' },
  { label: 'Histórico de relatórios', free: '6 meses', premium: 'Ilimitado' },
]
