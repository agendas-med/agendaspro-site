<template>
    <section class="text-center container mx-auto my-10" id="sobre">
        <h2 class="fontsize-lg-bold flex flex-wrap items-center gap-2 justify-center">Encontre, <p class="verde-escuro">agende</p> e resolva.</h2>
        <p class="fontsize-md my-6">
            O <strong>AgendasPro</strong> é uma plataforma que conecta você aos melhores profissionais e serviços da sua região de forma rápida e prática. Seja para agendar um corte de cabelo, uma consulta, um reparo ou qualquer outro serviço, você encontra aqui.
        </p>
        <div class="about-items py-10 flex flex-col gap-20">
            <div class="item grid grid-cols-1 md:grid-cols-2 gap-4 items-center text-center md:text-left">
                <div class="flex justify-center md:justify-end">
                    <img src="../assets/images/search.svg" class="w-50" alt="Busque o serviço">
                </div>
                <div class="item-text">
                    <h3 class="fontsize-md-bold">Busque o serviço que precisa</h3>
                    <p class="fontsize-sm">Use nosso buscador para encontrar empresas e profissionais na sua cidade ou região.</p>
                </div>
            </div>
            <div class="item grid grid-cols-1 md:grid-cols-2 gap-4 items-center text-center md:text-right">
                <div class="flex justify-center md:justify-start md:order-2">
                    <img src="../assets/images/schedule.svg" class="w-50" alt="Escolha o horário">
                </div>
                <div class="item-text md:order-1">
                    <h3 class="fontsize-md-bold">Escolha o melhor horário</h3>
                    <p class="fontsize-sm">Visualize os horários disponíveis e agende diretamente pela plataforma.</p>
                </div>
            </div>
            <div class="item grid grid-cols-1 md:grid-cols-2 gap-4 items-center text-center md:text-left">
                <div class="flex justify-center md:justify-end">
                    <img src="../assets/images/online.svg" class="w-50" alt="Receba a confirmação">
                </div>
                <div class="item-text">
                    <h3 class="fontsize-md-bold">Receba confirmação no WhatsApp</h3>
                    <p class="fontsize-sm">Você receberá notificações automáticas sobre o status do seu agendamento, direto no seu WhatsApp.</p>
                </div>
            </div>
            <div class="item grid grid-cols-1 md:grid-cols-2 gap-4 items-center text-center md:text-right">
                <div class="flex justify-center md:justify-start md:order-2">
                    <img src="../assets/images/credit-card.svg" class="w-50" alt="Pagamento fácil e seguro">
                </div>
                <div class="item-text md:order-1">
                    <h3 class="fontsize-md-bold">Pagamento fácil e seguro</h3>
                    <p class="fontsize-sm">Você pode realizar o pagamento no site com segurança, se a empresa oferecer essa opção.</p>
                </div>
            </div>
        </div>
    </section>
</template>
<script>
export default {
    name: "aboutComponent"
}
</script>
<style scoped>
</style>