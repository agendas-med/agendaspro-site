// =====================================================================================================
// MODELO A SER REVISADO POR ADVOGADO ANTES DA PUBLICAÇÃO.
// Os textos abaixo são um ponto de partida (LGPD, Lei 13.709/2018) e NÃO constituem aconselhamento
// jurídico. Prazos de retenção, bases legais, operadores listados e foro devem ser confirmados.
// Dados institucionais ([RAZÃO SOCIAL], [CNPJ], [ENDEREÇO], [EMAIL_DPO]...) vêm de src/config/company.js.
// Este aviso fica apenas aqui (código); ele não é exibido no site.
//
// Estrutura: { title, description, blocks: [ {h2}|{h3}|{p}|{ul:[]}|{table:{head:[],rows:[[]]}} ] }
// =====================================================================================================
import { company } from '../config/company.js'
import { plans } from './plans.js'
import { formatBRL } from '../lib/commission.js'

const c = company
const premiumPrice = () => formatBRL(plans.premium.priceCents)

const identification = () =>
  `${c.legalName}, inscrita no CNPJ sob o nº ${c.cnpj}, com sede em ${c.address} ("${c.brand}", "nós").`

export const legalDocs = {
  terms: () => ({
    title: 'Termos de Uso',
    description: 'Termos de Uso do AgendasPro: regras de uso da plataforma de agendamento, planos, comissões e responsabilidades.',
    blocks: [
      { p: `Última atualização: ${c.lastLegalUpdate}.` },
      { p: `Estes Termos de Uso regulam o acesso e o uso do site e da plataforma ${c.brand}, oferecidos por ${identification()}` },

      { h2: '1. Aceitação' },
      { p: 'Ao criar uma conta, usar a plataforma ou agendar um horário por uma página pública, você declara ter lido e concordado com estes Termos e com a Política de Privacidade. Se não concordar, não utilize o serviço.' },

      { h2: '2. O que é o AgendasPro' },
      { p: 'O AgendasPro é um software como serviço (SaaS) de agendamento para negócios de serviços. Ele oferece agenda por profissional, página pública de agendamento (link e QR Code), lembretes e confirmações pelo WhatsApp, recepção automatizada com inteligência artificial no WhatsApp, cobrança de sinal por Pix e relatórios.' },
      { p: 'Dois públicos usam o serviço: (a) o "Estabelecimento", empresa ou profissional que contrata o AgendasPro; e (b) o "Cliente final", pessoa que agenda um horário com o Estabelecimento. O AgendasPro não presta os serviços agendados; a relação de consumo é entre o Cliente final e o Estabelecimento.' },

      { h2: '3. Cadastro e conta' },
      { ul: [
        'Você deve informar dados verdadeiros e mantê-los atualizados, e ter capacidade legal para contratar.',
        'Você é responsável pela confidencialidade das credenciais e por toda atividade realizada na sua conta.',
        'Podemos suspender contas com indícios de fraude, uso abusivo ou violação destes Termos.',
      ] },

      { h2: '4. Planos, cobrança e comissão' },
      { p: `O AgendasPro tem os planos Free e Premium. O Free não tem mensalidade; o Premium custa ${premiumPrice()} por mês. Os limites e recursos de cada plano estão descritos na página de Preços, que integra estes Termos.` },
      { ul: [
        `Comissão: ${plans.free.commissionLabel} no plano Free e ${plans.premium.commissionLabel} no Premium, calculada sobre os valores recebidos por venda online (por exemplo, o sinal pago por Pix na página de agendamento). Recebimentos fora da plataforma não geram comissão.`,
        'Os pagamentos são processados pelo Asaas, que pode cobrar tarifas próprias conforme a tabela vigente dele. Essas tarifas não fazem parte da comissão do AgendasPro.',
        'A mensalidade do Premium é cobrada a cada ciclo mensal pelo Asaas. Em caso de inadimplência, após um prazo de tolerância a conta volta ao plano Free, sem exclusão dos cadastros.',
        'Não há fidelidade nem multa de cancelamento. Alterações de preço serão comunicadas com antecedência razoável.',
      ] },

      { h2: '5. Sinal e pagamentos de Clientes finais' },
      { p: 'O Estabelecimento define quais serviços exigem sinal e o valor. O horário é confirmado após a compensação do pagamento. As regras de cancelamento, remarcação e devolução do sinal são definidas pelo Estabelecimento e devem ser informadas ao Cliente final antes do pagamento. O AgendasPro não é parte da relação de consumo e atua como intermediador tecnológico.' },

      { h2: '6. WhatsApp e inteligência artificial' },
      { ul: [
        'As mensagens são enviadas pela WhatsApp Business Platform (Meta) e estão sujeitas às políticas da Meta. Você é responsável por usar o serviço apenas com pessoas que tenham relação com o seu negócio, sem envio de spam.',
        'A assistente com IA responde e agenda com base na agenda e nas regras do Estabelecimento. Embora tenha controles, a IA pode errar. Quando a conversa foge do básico, ela transfere para a equipe do Estabelecimento, que é responsável por acompanhar essas conversas.',
        'Conteúdos enviados para a IA podem ser processados por provedores de inteligência artificial, conforme a Política de Privacidade.',
      ] },

      { h2: '7. Obrigações do Estabelecimento' },
      { ul: [
        'Cumprir a legislação aplicável, inclusive a LGPD, atuando como controlador dos dados dos seus Clientes finais, com base legal adequada para o tratamento.',
        'Informar corretamente serviços, preços, horários e políticas de cancelamento.',
        'Não usar o serviço para fins ilícitos, para enviar mensagens indesejadas ou para violar direitos de terceiros.',
        'Não tentar acessar áreas restritas, sobrecarregar a infraestrutura ou copiar o software.',
      ] },

      { h2: '8. Recursos em desenvolvimento' },
      { p: 'Alguns recursos aparecem no site com o selo "Em breve" (por exemplo, dashboard do Instagram, integração com o Google Agenda, lista de espera e reativação de clientes). Eles ainda não estão disponíveis, podem mudar e não constituem promessa de data de entrega.' },

      { h2: '9. Propriedade intelectual' },
      { p: `O software, a marca ${c.brand}, o design e os textos do serviço pertencem a nós ou a nossos licenciantes. Concedemos a você uma licença limitada, revogável e não exclusiva de uso durante a vigência da conta. Os dados que você cadastra continuam sendo seus.` },

      { h2: '10. Disponibilidade e limitação de responsabilidade' },
      { p: 'Empregamos esforços razoáveis para manter o serviço disponível, mas não garantimos funcionamento ininterrupto, inclusive por falhas de terceiros (WhatsApp, Asaas, provedores de nuvem). Na máxima extensão permitida em lei, não respondemos por lucros cessantes ou danos indiretos, e nossa responsabilidade total limita-se ao valor pago por você nos 12 meses anteriores ao fato, ressalvadas as hipóteses em que a lei não permita a limitação.' },

      { h2: '11. Encerramento' },
      { p: 'Você pode encerrar a conta a qualquer momento. Podemos encerrar ou suspender o serviço em caso de violação destes Termos. Após o encerramento, os dados serão tratados conforme a Política de Privacidade.' },

      { h2: '12. Alterações destes Termos' },
      { p: 'Podemos atualizar estes Termos. Mudanças relevantes serão comunicadas por e-mail ou aviso na plataforma. O uso continuado após a vigência da nova versão indica concordância.' },

      { h2: '13. Lei aplicável e foro' },
      { p: `Estes Termos são regidos pelas leis do Brasil. Fica eleito o foro da comarca da sede de ${c.legalName}, ressalvado o foro do domicílio do consumidor quando a lei assim determinar.` },

      { h2: '14. Contato' },
      { p: `Dúvidas sobre estes Termos: ${c.supportEmail}. Assuntos de dados pessoais: ${c.dpoEmail}.` },
    ],
  }),

  privacy: () => ({
    title: 'Política de Privacidade',
    description: 'Política de Privacidade do AgendasPro (LGPD): quais dados tratamos, bases legais, compartilhamento, retenção e direitos dos titulares.',
    blocks: [
      { p: `Última atualização: ${c.lastLegalUpdate}.` },
      { p: `Esta Política explica como ${identification()} trata dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, "LGPD").` },

      { h2: '1. Nossos papéis: controlador e operador' },
      { ul: [
        `Controlador: somos controladores dos dados de visitantes do site, de leads comerciais e dos usuários (pessoas que criam conta) dos Estabelecimentos, para cadastro, cobrança, segurança, suporte e comunicações do serviço.`,
        'Operador: quanto aos dados dos Clientes finais dos Estabelecimentos (nome, WhatsApp, e-mail, histórico de agendamentos e conversas), tratamos em nome do Estabelecimento, que é o controlador e define as finalidades. Para exercer direitos sobre esses dados, o titular deve falar primeiro com o Estabelecimento; nós ajudamos o Estabelecimento a atender.',
      ] },

      { h2: '2. Quais dados tratamos e para quê' },
      { table: {
        head: ['Quem', 'Dados', 'Finalidade', 'Base legal (LGPD, art. 7º)'],
        rows: [
          ['Visitante do site', 'Dados de navegação (IP, dispositivo, páginas), cookies e identificadores, mediante consentimento para os não essenciais', 'Funcionamento, segurança, estatísticas e mensuração de campanhas', 'Legítimo interesse (essenciais e segurança); consentimento (analíticos e marketing)'],
          ['Lead comercial', 'Nome, WhatsApp, e-mail (opcional), segmento, mensagem, origem do contato', 'Responder ao pedido de contato e apresentar o serviço', 'Procedimentos preliminares a contrato; legítimo interesse'],
          ['Usuário do Estabelecimento', 'Nome, e-mail, telefone, dados do negócio, registros de acesso', 'Criar e manter a conta, prestar o serviço, cobrança, suporte', 'Execução de contrato; obrigação legal; legítimo interesse'],
          ['Cliente final (via Estabelecimento)', 'Nome, WhatsApp, e-mail (opcional), serviço e horário, status de pagamento do sinal, mensagens trocadas com a assistente', 'Agendar, confirmar, lembrar, cobrar sinal e atender pelo WhatsApp em nome do Estabelecimento', 'Execução de contrato/procedimentos preliminares; consentimento registrado no agendamento'],
          ['Todos', 'Registros de acesso e segurança (IP, data/hora)', 'Segurança, prevenção a fraudes e cumprimento do Marco Civil da Internet', 'Obrigação legal; legítimo interesse'],
        ],
      } },
      { p: 'Não solicitamos dados pessoais sensíveis (como dados de saúde) para agendar. Pedimos que Estabelecimentos e Clientes finais não os informem em campos livres ou em conversas com a assistente.' },

      { h2: '3. Compartilhamento com terceiros' },
      { p: 'Compartilhamos dados apenas na medida necessária, com prestadores que atuam como operadores ou controladores independentes, conforme o caso:' },
      { table: {
        head: ['Terceiro', 'Papel', 'Dados'],
        rows: [
          ['Asaas', 'Processamento de pagamentos (Pix do sinal) e cobrança do plano Premium', 'Nome, contato e dados necessários à cobrança; valor e status do pagamento'],
          ['Meta (WhatsApp Business Platform)', 'Envio e recebimento de mensagens de confirmação, lembretes e atendimento', 'Número de WhatsApp, conteúdo das mensagens'],
          ['OpenAI (ou outro provedor de IA)', 'Interpretação das mensagens e apoio à assistente de agendamento', 'Trechos de conversa e contexto mínimo da agenda, sem envio de dados desnecessários'],
          ['Google', 'Google Agenda (recurso em breve, Premium) e Google Analytics, se você consentir', 'Dados de agenda sincronizados; dados de navegação'],
          ['Cloudflare', 'Verificação anti-robô (Turnstile) e infraestrutura', 'IP e sinais técnicos do navegador'],
          ['Provedores de nuvem e e-mail', 'Hospedagem, banco de dados, backup e e-mails transacionais', 'Dados necessários à operação, com criptografia'],
          ['Autoridades', 'Cumprimento de obrigação legal ou ordem judicial', 'Mediante requisição válida'],
        ],
      } },
      { p: 'Não vendemos dados pessoais. Alguns desses provedores podem tratar dados fora do Brasil; nesses casos adotamos as salvaguardas do art. 33 da LGPD (por exemplo, cláusulas contratuais ou decisão de adequação).' },

      { h2: '4. Por quanto tempo guardamos' },
      { ul: [
        'Leads comerciais: até 12 meses após o último contato, salvo se virarem clientes.',
        'Conta e dados do Estabelecimento: durante a vigência do contrato e, depois, pelo prazo necessário a obrigações legais, fiscais e ao exercício regular de direitos (em regra, até 5 anos).',
        'Dados de Clientes finais: pelo período definido pelo Estabelecimento (controlador) e enquanto a conta existir, observados os prazos legais.',
        'Registros de acesso: 6 meses, conforme o Marco Civil da Internet.',
        'Ao final, os dados são excluídos ou anonimizados, salvo guarda obrigatória por lei.',
      ] },

      { h2: '5. Seus direitos' },
      { p: 'Você pode, a qualquer momento e mediante requisição, exercer os direitos do art. 18 da LGPD:' },
      { ul: [
        'confirmação da existência de tratamento e acesso aos dados;',
        'correção de dados incompletos, inexatos ou desatualizados;',
        'anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;',
        'portabilidade, nos termos da regulamentação;',
        'eliminação dos dados tratados com base no consentimento;',
        'informação sobre com quem compartilhamos os dados;',
        'informação sobre a possibilidade de não consentir e suas consequências;',
        'revogação do consentimento;',
        'revisão de decisões tomadas unicamente por tratamento automatizado;',
        'oposição a tratamento realizado com base em hipótese de dispensa de consentimento, em caso de descumprimento da lei;',
        'petição à Autoridade Nacional de Proteção de Dados (ANPD).',
      ] },
      { p: `Para exercê-los, escreva ao nosso Encarregado pelo Tratamento de Dados Pessoais (DPO): ${c.dpoName}, ${c.dpoEmail}. Responderemos em prazo razoável, conforme a regulamentação. Se o seu dado é tratado por um Estabelecimento como controlador, podemos encaminhar o pedido a ele.` },

      { h2: '6. Segurança' },
      { p: 'Adotamos medidas técnicas e organizacionais razoáveis, como comunicação criptografada (HTTPS), controle de acesso, criptografia de credenciais sensíveis, registros de auditoria e limitação de tentativas. Nenhum sistema é totalmente imune; em caso de incidente de segurança relevante, comunicaremos os titulares e a ANPD conforme a LGPD.' },

      { h2: '7. Cookies e tecnologias semelhantes' },
      { p: 'Usamos cookies e armazenamento local essenciais ao funcionamento do site. Cookies de estatística e marketing só são carregados se você consentir. Veja detalhes e como alterar sua escolha na Política de Cookies.' },

      { h2: '8. Crianças e adolescentes' },
      { p: 'O AgendasPro é destinado a empresas e profissionais. Agendamentos de menores de idade devem ser feitos por seus responsáveis legais.' },

      { h2: '9. Alterações desta Política' },
      { p: 'Podemos atualizar esta Política. A data da última atualização está no início do texto e, em mudanças relevantes, avisaremos por e-mail ou na plataforma.' },

      { h2: '10. Contato e Encarregado (DPO)' },
      { ul: [
        `Controlador: ${c.legalName}, CNPJ ${c.cnpj}, ${c.address}.`,
        `Encarregado (DPO): ${c.dpoName}, ${c.dpoEmail}.`,
      ] },
    ],
  }),

  cookies: () => ({
    title: 'Política de Cookies',
    description: 'Política de Cookies do AgendasPro: quais cookies e armazenamentos usamos, para quê e como gerenciar suas preferências.',
    blocks: [
      { p: `Última atualização: ${c.lastLegalUpdate}.` },
      { p: 'Esta Política explica como o site usa cookies e tecnologias semelhantes (como o armazenamento local do navegador) e como você pode controlá-los. Ela complementa a Política de Privacidade.' },

      { h2: '1. Categorias' },
      { table: {
        head: ['Categoria', 'Exemplos', 'Finalidade', 'Precisa de consentimento?'],
        rows: [
          ['Essenciais', 'Registro da sua escolha de cookies; origem da visita da sessão; verificação anti-robô (Cloudflare Turnstile)', 'Funcionamento, segurança e lembrar suas preferências', 'Não'],
          ['Estatísticas', 'Google Analytics 4, Microsoft Clarity (se ativados)', 'Entender como o site é usado para melhorá-lo', 'Sim'],
          ['Marketing', 'Meta Pixel (se ativado)', 'Medir a eficácia de anúncios e criar públicos', 'Sim'],
        ],
      } },
      { p: 'Cookies de estatística e marketing só são carregados depois que você aceita no aviso exibido no site. Sem aceite, essas ferramentas não são carregadas.' },

      { h2: '2. Como gerenciar' },
      { ul: [
        'Use o botão "Preferências de cookies" no rodapé do site para aceitar, recusar ou personalizar a qualquer momento.',
        'Você também pode apagar ou bloquear cookies nas configurações do navegador, o que pode afetar o funcionamento de partes do site.',
        'Se revogar o consentimento, recarregaremos a página para parar de carregar as ferramentas já ativas.',
      ] },

      { h2: '3. Terceiros' },
      { p: 'Ferramentas de terceiros têm suas próprias políticas: Google, Microsoft, Meta e Cloudflare. Elas podem tratar dados fora do Brasil.' },

      { h2: '4. Contato' },
      { p: `Dúvidas: ${c.dpoEmail}.` },
    ],
  }),
}
