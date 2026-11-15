// Landings por nicho geradas a partir deste arquivo (rota /para/:slug). Sem números ou casos inventados.
// icon: nome do ícone em components/ui/AppIcon.vue

export const niches = [
  {
    slug: 'clinicas',
    name: 'Clínicas',
    short: 'Clínicas e consultórios',
    icon: 'heart',
    title: 'Agendamento online para clínicas e consultórios',
    description:
      'Agenda por profissional, página de agendamento com QR Code, lembretes no WhatsApp e sinal por Pix para reduzir faltas na sua clínica.',
    headline: 'Menos faltas e uma recepção que não para, na sua clínica',
    lead: 'Organize a agenda de cada profissional, deixe o paciente marcar sozinho e confirme tudo pelo WhatsApp. Cobre um sinal por Pix nos horários que mais pesam no caixa.',
    pains: [
      'Paciente que esquece e a cadeira fica vazia.',
      'Recepção ocupada respondendo as mesmas perguntas no WhatsApp.',
      'Remarcações que bagunçam a agenda de vários profissionais.',
    ],
    solutions: [
      'Lembrete e confirmação automáticos pelo WhatsApp.',
      'Página pública com horários reais de cada profissional.',
      'Sinal por Pix para garantir o horário de consultas e retornos.',
    ],
    services: ['Consulta', 'Retorno', 'Exame', 'Avaliação inicial'],
    faq: [
      {
        q: 'Posso ter vários profissionais na mesma clínica?',
        a: 'Sim. Cada profissional tem agenda própria. No plano Free há 1 profissional; no Premium, ilimitados.',
      },
      {
        q: 'O paciente precisa informar dados de saúde para agendar?',
        a: 'Não. A página pública pede apenas nome, WhatsApp e, se quiser, e-mail. Informações clínicas ficam com a sua clínica.',
      },
    ],
  },
  {
    slug: 'estetica',
    name: 'Estética',
    short: 'Estética e bem-estar',
    icon: 'sparkles',
    title: 'Agendamento online para clínicas de estética',
    description:
      'Agende procedimentos de estética com página pública, sinal por Pix, lembretes no WhatsApp e agenda por profissional.',
    headline: 'Procedimento marcado é procedimento pago: reduza o no-show na estética',
    lead: 'Sessões longas e horários valiosos não podem ficar vazios. Cobre um sinal por Pix no agendamento e lembre o cliente automaticamente pelo WhatsApp.',
    pains: [
      'Horário de procedimento vago em cima da hora.',
      'Clientes que pedem horário pelo Instagram e esperam horas por resposta.',
      'Controle manual de quem pagou sinal e quem não pagou.',
    ],
    solutions: [
      'Sinal por Pix confirmado automaticamente, sem conferir comprovante.',
      'Link de agendamento para a bio do Instagram (e QR Code para o balcão).',
      'Assistente de IA no WhatsApp respondendo e agendando 24h.',
    ],
    services: ['Limpeza de pele', 'Depilação', 'Massagem', 'Design de sobrancelhas'],
    faq: [
      {
        q: 'Dá para cobrar sinal só de alguns serviços?',
        a: 'Sim. O sinal é definido por serviço: você escolhe quais exigem pagamento antecipado.',
      },
      {
        q: 'Como o cliente chega até a página de agendamento?',
        a: 'Por um link (ideal para a bio do Instagram) ou por QR Code. O link pode identificar a origem do agendamento.',
      },
    ],
  },
  {
    slug: 'barbearia',
    name: 'Barbearias',
    short: 'Barbearias e salões',
    icon: 'scissors',
    title: 'Agendamento online para barbearias',
    description:
      'Agenda por barbeiro, link de agendamento para o Instagram, lembretes no WhatsApp e sinal por Pix. Menos furo, mais cadeira ocupada.',
    headline: 'Cadeira cheia o dia todo, sem ficar no WhatsApp respondendo horário',
    lead: 'Cada barbeiro com a sua agenda, o cliente marcando sozinho pelo link e o lembrete saindo no WhatsApp. Sem caderninho, sem furo.',
    pains: [
      'Cliente que marca e não aparece.',
      'Barbeiro respondendo mensagem com a mão ocupada.',
      'Encaixes feitos de cabeça e horário duplicado.',
    ],
    solutions: [
      'Agenda por profissional sem conflito de horário.',
      'Link na bio e QR Code no espelho da barbearia.',
      'Lembrete automático e sinal por Pix nos horários concorridos.',
    ],
    services: ['Corte', 'Barba', 'Corte + barba', 'Sobrancelha'],
    faq: [
      {
        q: 'O cliente escolhe o barbeiro?',
        a: 'Sim, ou escolhe “qualquer profissional” e pega o primeiro horário disponível.',
      },
      {
        q: 'Preciso cobrar sinal de todos?',
        a: 'Não. O sinal é opcional e configurado por serviço.',
      },
    ],
  },
  {
    slug: 'saloes',
    name: 'Salões de beleza',
    short: 'Salões de beleza',
    icon: 'scissors',
    title: 'Agendamento online para salões de beleza',
    description:
      'Agenda para toda a equipe do salão, página de agendamento, confirmação no WhatsApp e sinal por Pix para serviços longos.',
    headline: 'Agenda do salão organizada e clientes confirmadas antes do horário',
    lead: 'Coloração e mechas ocupam horas da agenda. Garanta o horário com sinal por Pix e confirme com a cliente pelo WhatsApp.',
    pains: [
      'Serviço longo cancelado de última hora.',
      'Recepção dividida entre atender e agendar.',
      'Dificuldade em saber a agenda de cada profissional.',
    ],
    solutions: [
      'Agenda por profissional com horários e bloqueios.',
      'Cliente agenda pelo celular, a qualquer hora.',
      'Lembretes e confirmações pelo WhatsApp.',
    ],
    services: ['Corte', 'Escova', 'Coloração', 'Manicure'],
    faq: [
      {
        q: 'Funciona para salão com várias profissionais?',
        a: 'Sim. No Premium não há limite de profissionais nem de usuários na equipe.',
      },
      {
        q: 'Posso começar sem pagar mensalidade?',
        a: 'Sim. O plano Free não tem mensalidade; a comissão é de 5% apenas sobre vendas online.',
      },
    ],
  },
  {
    slug: 'odontologia',
    name: 'Odontologia',
    short: 'Consultórios odontológicos',
    icon: 'tooth',
    title: 'Agendamento online para consultórios odontológicos',
    description:
      'Reduza faltas no consultório odontológico com lembretes no WhatsApp, página de agendamento e sinal por Pix.',
    headline: 'Cadeira odontológica parada custa caro: reduza as faltas',
    lead: 'Confirme consultas e retornos pelo WhatsApp, deixe o paciente remarcar sozinho e proteja horários longos com sinal por Pix.',
    pains: [
      'Falta em consulta e em procedimento marcado com semanas de antecedência.',
      'Telefone ocupado na recepção em horário de pico.',
      'Remarcações feitas por mensagem solta, sem registro.',
    ],
    solutions: [
      'Confirmação e lembrete automáticos, com remarcação pelo link.',
      'Agenda por dentista com duração por procedimento.',
      'Recepção com IA no WhatsApp fora do horário comercial.',
    ],
    services: ['Avaliação', 'Limpeza', 'Clareamento', 'Retorno'],
    faq: [
      {
        q: 'O paciente consegue remarcar sem ligar?',
        a: 'Sim. Após agendar, ele recebe um link de gestão para ver, cancelar ou reagendar, respeitando a antecedência mínima que você definir.',
      },
      {
        q: 'Os dados dos pacientes ficam protegidos?',
        a: 'Tratamos os dados conforme a LGPD, como descrito na Política de Privacidade. A página de agendamento coleta o mínimo necessário.',
      },
    ],
  },
  {
    slug: 'psicologia',
    name: 'Psicologia',
    short: 'Psicólogos e terapeutas',
    icon: 'chat',
    title: 'Agendamento online para psicólogos e terapeutas',
    description:
      'Agenda de sessões com confirmação no WhatsApp, página de agendamento e sinal por Pix para reduzir faltas em psicologia.',
    headline: 'Sessões confirmadas, sem você interromper o atendimento para responder',
    lead: 'Defina seus horários, compartilhe o link e deixe o AgendasPro confirmar e lembrar o paciente. Tudo com o mínimo de dados necessário.',
    pains: [
      'Responder pedidos de horário entre uma sessão e outra.',
      'Faltas e cancelamentos em cima da hora.',
      'Combinar cobrança de sessão perdida de forma constrangedora.',
    ],
    solutions: [
      'Página de agendamento com os seus horários reais.',
      'Lembrete e confirmação automáticos no WhatsApp.',
      'Sinal por Pix configurável, com política clara de remarcação.',
    ],
    services: ['Sessão individual', 'Primeira consulta', 'Sessão online'],
    faq: [
      {
        q: 'A página pede algum dado clínico?',
        a: 'Não. Pede apenas nome, WhatsApp e, se desejar, e-mail, além do consentimento para tratamento dos dados.',
      },
      {
        q: 'Posso usar sendo profissional autônomo?',
        a: 'Sim. O plano Free atende 1 profissional sem mensalidade.',
      },
    ],
  },
  {
    slug: 'pet',
    name: 'Pet shops e veterinárias',
    short: 'Pet shops e veterinárias',
    icon: 'paw',
    title: 'Agendamento online para pet shops e clínicas veterinárias',
    description:
      'Banho, tosa e consultas veterinárias com agenda online, lembretes no WhatsApp e sinal por Pix para garantir o horário.',
    headline: 'Banho e tosa agendados sem troca de mensagens',
    lead: 'O tutor escolhe o serviço e o horário pelo celular e recebe a confirmação no WhatsApp. Você ganha tempo e uma agenda previsível.',
    pains: [
      'Agenda de banho e tosa montada em conversas de WhatsApp.',
      'Tutor que não avisa quando não vai poder levar o pet.',
      'Sobreposição de horários entre profissionais.',
    ],
    solutions: [
      'Serviços com duração e preço configurados.',
      'Lembrete automático e link para cancelar ou reagendar.',
      'Sinal por Pix para serviços mais longos.',
    ],
    services: ['Banho', 'Tosa', 'Consulta veterinária', 'Vacina'],
    faq: [
      {
        q: 'Posso cadastrar serviços com durações diferentes?',
        a: 'Sim. Cada serviço tem a sua duração, e os horários oferecidos respeitam isso.',
      },
      {
        q: 'O tutor precisa criar conta?',
        a: 'Não. Ele informa nome e WhatsApp, aceita o tratamento de dados e agenda.',
      },
    ],
  },
  {
    slug: 'fisioterapia',
    name: 'Fisioterapia',
    short: 'Fisioterapia e reabilitação',
    icon: 'activity',
    title: 'Agendamento online para fisioterapia',
    description:
      'Agenda recorrente de sessões, lembretes no WhatsApp e página de agendamento para clínicas e profissionais de fisioterapia.',
    headline: 'Sessões em dia e pacientes presentes na fisioterapia',
    lead: 'Pacientes de fisioterapia voltam várias vezes. Facilite o agendamento e confirme cada sessão pelo WhatsApp para manter o tratamento no ritmo.',
    pains: [
      'Muitas sessões por paciente e muitos lembretes manuais.',
      'Faltas que atrasam o tratamento.',
      'Agenda cheia de remarcações.',
    ],
    solutions: [
      'Lembretes automáticos antes de cada sessão.',
      'Reagendamento pelo link, sem ligar para a recepção.',
      'Relatórios de comparecimento por período.',
    ],
    services: ['Avaliação', 'Sessão de fisioterapia', 'Pilates clínico'],
    faq: [
      {
        q: 'Consigo ver quantos pacientes faltaram no mês?',
        a: 'Os relatórios mostram agendamentos e comparecimento por período e por profissional.',
      },
      {
        q: 'Posso receber o sinal por Pix?',
        a: 'Sim, para os serviços em que você quiser exigir pagamento antecipado.',
      },
    ],
  },
]

export const nicheBySlug = Object.fromEntries(niches.map((n) => [n.slug, n]))
