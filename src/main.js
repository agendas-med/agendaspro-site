import { createApp } from 'vue';
import App from './App.vue';
import router from './routes/router';

const app = createApp(App);

app.use(router);

app.mount('#app');

// Aguarda o DOM estar completamente carregado antes de executar o script
document.addEventListener('DOMContentLoaded', () => {

  // Adiciona um único listener de clique no documento inteiro
  document.addEventListener('click', (event) => {
    
    // 1. Verifica se o clique foi em um link com a propriedade `data-anchor`
    // closest() é usado para garantir que o clique funcione mesmo se houver outros elementos dentro do link (ex: um <span> ou <img>)
    const anchorLink = event.target.closest('a[anchor]');

    // Se não foi em um link com data-anchor, não faz nada
    if (!anchorLink) {
      return;
    }

    // 2. Previne o comportamento padrão do link
    // Isso é crucial para evitar que o ID seja adicionado à URL
    event.preventDefault();

    // 3. Pega o ID do destino a partir do atributo href do link
    const targetId = anchorLink.getAttribute('href');
    
    // Verifica se o href é um seletor de ID válido (começa com #)
    if (!targetId || !targetId.startsWith('#')) {
      console.warn('O atributo href do link com data-anchor deve ser um ID válido (ex: "#secao").');
      return;
    }

    // 4. Encontra o elemento de destino na página
    const targetElement = document.querySelector(targetId);

    // 5. Se o elemento de destino existir, rola a página suavemente até ele
    if (targetElement) {
      targetElement.scrollIntoView({
        behavior: 'smooth', // A mágica do scroll suave acontece aqui
        block: 'start'      // Opcional: alinha o topo do elemento ao topo da tela
      });
    } else {
      console.warn(`O elemento de destino com o ID "${targetId}" não foi encontrado.`);
    }
  });

});