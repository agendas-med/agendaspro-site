<template>
  <header class="flex justify-between p-4 md:p-6 items-center relative shadow-sm bg-white"> <img src="../assets/AGENDASPRO.png" alt="Logo AgendasPRO" class="h-10 md:h-12 w-auto">
    <div class="md:hidden">
      <button @click="toggleMobileMenu" class="text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500">
        <svg v-if="!isMobileMenuOpen" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" />
        </svg>
        <svg v-else class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <nav class="hidden md:flex items-center">
      <ul class="flex items-center gap-8 lg:gap-10">
        <li><a href="#" class="text-gray-600 hover:text-indigo-600">Agendar</a></li>
        <li><a href="#" class="text-gray-600 hover:text-indigo-600">Sobre</a></li>
        <li><a href="#" class="text-gray-600 hover:text-indigo-600">Perguntas frequentes</a></li>
      </ul>
    </nav>

    <div class="hidden md:flex gap-3 items-center">
      <a href="#" class="text-gray-600 hover:text-indigo-600">Entrar</a>
      <button class="btn btn-primary">Registrar</button>
    </div>

    <transition name="slide-fade">
      <div v-if="isMobileMenuOpen" class="md:hidden absolute top-full left-0 right-0 bg-white shadow-lg z-20 overflow-hidden">
        <nav class="px-4 pt-2 pb-4 border-t border-gray-200">
          <ul class="flex flex-col gap-3">
            <li><a href="#" @click="closeMobileMenu" class="block py-2 text-gray-700 hover:bg-gray-100 rounded">Agendar</a></li>
            <li><a href="#" @click="closeMobileMenu" class="block py-2 text-gray-700 hover:bg-gray-100 rounded">Sobre</a></li>
            <li><a href="#" @click="closeMobileMenu" class="block py-2 text-gray-700 hover:bg-gray-100 rounded">Perguntas frequentes</a></li>
          </ul>
          <div class="mt-4 pt-4 border-t border-gray-200 flex flex-col gap-3">
            <a href="#" @click="closeMobileMenu" class="block py-2 text-center text-gray-700 hover:bg-gray-100 rounded">Entrar</a>
            <button @click="closeMobileMenu" class="btn btn-primary w-full" style="max-width: 100%;">Registrar</button>
          </div>
        </nav>
      </div>
    </transition>
  </header>
</template>

<script>
export default {
  name: "headerComponent",
  data() {
    return {
      isMobileMenuOpen: false,
    };
  },
  methods: {
    toggleMobileMenu() {
      this.isMobileMenuOpen = !this.isMobileMenuOpen;
    },
    closeMobileMenu() {
      this.isMobileMenuOpen = false; // Para fechar o menu ao clicar em um item
    }
  }
};
</script>

<style scoped>
img {
    width: 170px;
    object-fit: contain; 
}


</style>