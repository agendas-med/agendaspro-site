<template>
    <section>
        <headerComponent></headerComponent>
        <homeComponent></homeComponent>
        <aboutComponent></aboutComponent>
        <questionsComponent></questionsComponent>
        <footerComponent></footerComponent>
        <scrollButton></scrollButton>
    </section>
</template>

<script>
import headerComponent from "../components/headerComponent.vue";
import homeComponent from "../components/homeComponent.vue";
import aboutComponent from "../components/aboutComponent.vue";
import questionsComponent from "../components/questionsComponent.vue";
import footerComponent from "../components/footerComponent.vue";
import scrollButton from "../components/scrollButton.vue";

export default {
    name: "indexPage",
    components: {
        headerComponent,
        homeComponent,
        aboutComponent,
        questionsComponent,
        footerComponent,
        scrollButton
    }
}
</script>

<style scoped>

</style>