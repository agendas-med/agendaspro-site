<template>
  <button
    v-show="isVisible"
    @click="scrollToTop"
    class="fixed bottom-5 right-5 z-50 w-12 h-12 bg-white verde rounded-full flex items-center justify-center shadow-lg hover:gb-verde-escuro hover:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-opacity duration-300"
    aria-label="Voltar ao topo"
  >
    <i class="fa-solid fa-arrow-up"></i>
  </button>
</template>

<script>
export default {
  data() {
    return {
      // Controla a visibilidade do botão
      isVisible: false,
    };
  },
  methods: {
    // Método para rolar a janela para o topo suavemente
    scrollToTop() {
      document.querySelector(".main-app").scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    },
    // Método para verificar a posição do scroll e atualizar a visibilidade
    handleScroll() {
      // Mostra o botão se o scroll passar de 200px
      if (document.querySelector(".main-app").scrollTop > 200) {
        this.isVisible = true;
      } else {
        this.isVisible = false;
      }
    },
  },
  // Hooks do Ciclo de Vida
  mounted() {
    // Adiciona o listener de scroll quando o componente é montado
    document.querySelector(".main-app").addEventListener('scroll', this.handleScroll);
  },
  beforeUnmount() {
    // IMPORTANTE: Remove o listener para evitar memory leaks quando o componente é destruído
    document.querySelector(".main-app").removeEventListener('scroll', this.handleScroll);
  },
};
</script>

<style scoped>
/* O v-show funciona alterando a propriedade 'display'.
   Para uma transição suave de opacidade, você pode preferir usar uma classe.
   Mas para este caso, o v-show combinado com a classe de transição já funciona bem na maioria dos navegadores modernos.
*/
</style>