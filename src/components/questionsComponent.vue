<template>
  <section class="container mx-auto my-10 px-4" id="perguntas">
    <h2 class="fontsize-lg-bold flex flex-wrap items-center gap-2 justify-center">
      Perguntas <span class="verde-escuro">frequentes</span>
    </h2>

    <div class="w-full max-w-3xl mx-auto flex flex-col gap-4 mt-8">
      
      <div 
        v-for="(faq, index) in faqs" 
        :key="index"
        class="accordion-item group"
        :data-state="faq.isOpen ? 'open' : 'closed'"
      >
        <button 
          @click="toggleAccordion(faq)"
          class="accordion-header flex justify-between items-center w-full p-5 sm:p-6 text-left bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <span class="text-lg font-semibold text-gray-800">{{ faq.question }}</span>
          <svg class="accordion-icon w-6 h-6 text-gray-700 transition-transform duration-300 group-data-[state=open]:rotate-180" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>

        <div 
          class="accordion-content grid grid-rows-[0fr] transition-[grid-template-rows] duration-400 ease-in-out bg-white rounded-b-lg data-[state=open]:grid-rows-[1fr] data-[state=open]:border data-[state=open]:border-t-0 data-[state=open]:border-gray-200"
          :data-state="faq.isOpen ? 'open' : 'closed'"
        >
          <div class="overflow-hidden">
            <p class="text-gray-600 p-5 sm:p-6 pt-2 leading-relaxed text-left">{{ faq.answer }}</p>
          </div>
        </div>
      </div>

    </div>
  </section>
</template>

<script>
export default {
  name: 'FaqComponent', // Nome do componente
  data() {
    return {
      // A lista de perguntas agora fica dentro de data()
      faqs: [
        {
          question: 'Como faço para agendar um serviço?',
          answer: 'Clique em "Agendar" no topo da página, selecione o tipo de serviço, escolha a cidade ou região e siga as instruções para escolher o horário.',
          isOpen: false,
        },
        {
          question: 'Preciso pagar online?',
          answer: 'Algumas empresas oferecem pagamento online, outras permitem que você pague no local. A opção aparece durante o agendamento.',
          isOpen: false,
        },
        {
          question: 'Como recebo a confirmação do meu agendamento?',
          answer: 'Você recebe notificações automáticas no WhatsApp com a confirmação, lembretes e qualquer atualização.',
          isOpen: false,
        },
        {
          question: 'Posso cancelar ou reagendar?',
          answer: 'Sim! Basta acessar seu painel de agendamentos (após login) e escolher reagendar ou cancelar, respeitando as políticas da empresa.',
          isOpen: false,
        },
        {
          question: 'É seguro agendar pelo AgendasPro?',
          answer: 'Sim. Toda a navegação é protegida por HTTPS, e os dados de pagamento (quando disponíveis) são criptografados por um sistema seguro.',
          isOpen: false,
        }
      ]
    };
  },
  methods: {
    // A função para alternar o estado fica dentro de methods
    toggleAccordion(clickedFaq) {
      clickedFaq.isOpen = !clickedFaq.isOpen;
    }
  }
};
</script>

<style scoped>
/* Estilos específicos do componente podem ir aqui, se necessário */
</style>