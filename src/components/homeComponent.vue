<template>
    <section class="flex items-center justify-center">
        <img src="../assets/hero-background.png">
        <div class="procurar-agendamento m-6">
            <p class="fontsize-xl-bold">Busque um serviço</p>
            <p class="fontsize-lg">Realize seu agendamento hoje</p>
            <div class="busca-inputs flex gap-1 my-4 flex-wrap">
                <input type="text" name="servico" id="servico" placeholder="Serviço, Ex. Barbearia" required>
                <input type="text" name="regiao" id="regiao" placeholder="Cidade ou região">
                <button class="btn btn-cinza" style="width: 150px;">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    Procurar
                </button>
            </div>
        </div>
    </section>
</template>
<script>
export default {
    name: "homeComponent"
}
</script>
<style scoped>
section {
    position: relative;
    height: 65vh;
}
img {
    height: 65vh;
    object-fit: cover;
    width: 100vw;
    position: absolute;
    top: 0;
    left: 0;
}
.procurar-agendamento {
    position: relative;
    z-index: 2;

    & p {
        color: var(--branco);
    }
    
}
</style>