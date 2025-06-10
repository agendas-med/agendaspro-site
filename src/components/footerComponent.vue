<template>
  <footer class="bg-verde-escuro mt-20 text-white">
    <div class="container mx-auto px-4 py-12">
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 text-center sm:text-left">
        
        <div>
          <h3 class="text-2xl font-bold">AGENDASPRO</h3>
          <div class="flex gap-4 mt-4 justify-center sm:justify-start">
            <a href="#" aria-label="Instagram" class="hover:opacity-75 transition-opacity">
              <i class="fa-brands fa-instagram fa-xl"></i>
            </a>
            <a href="#" aria-label="LinkedIn" class="hover:opacity-75 transition-opacity">
              <i class="fa-brands fa-linkedin fa-xl"></i>
            </a>
            <a href="#" aria-label="WhatsApp" class="hover:opacity-75 transition-opacity">
              <i class="fa-brands fa-whatsapp fa-xl"></i>
            </a>
          </div>
        </div>

        <div>
          <h4 class="font-semibold mb-4 text-lg">Para usuários</h4>
          <ul class="space-y-2">
            <li><a href="#agendar" anchor>Agendar</a></li>
            <li><a href="#sobre" anchor>Sobre</a></li>
            <li><a href="#perguntas" anchor>Perguntas Frequentes</a></li>
          </ul>
        </div>

        <div>
          <h4 class="font-semibold mb-4 text-lg">Para empresas</h4>
          <ul class="space-y-2">
            <li><a href="#">Cadastre seu negócio</a></li>
            <li><a href="#">Painel administrativo</a></li>
            <li><a href="#">Central de ajuda</a></li>
          </ul>
        </div>
      </div>

      <div class="mt-12 pt-8 border-t border-white/20 text-center sm:text-left">
        <div class="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div class="flex gap-6 text-sm">
                <a href="#" class="hover:underline">Termos de uso</a>
                <a href="#" class="hover:underline">Política de privacidade</a>
            </div>
            <p class="text-sm text-white/80">
              © 2025 AgendasPro - Todos os direitos reservados.
            </p>
        </div>
      </div>

    </div>
  </footer>
</template>

<script>
export default {
  name: 'FooterComponent'
}
</script>

<style scoped>
/* Estilos adicionais podem ser inseridos aqui, se necessário */
</style>