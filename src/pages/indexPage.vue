<template>
    <section>
        <headerComponent></headerComponent>
        <homeComponent></homeComponent>
    </section>
</template>

<script>
import headerComponent from "../components/headerComponent.vue";
import homeComponent from "../components/homeComponent.vue";

export default {
    name: "indexPage",
    components: {
        headerComponent,
        homeComponent
    }
}
</script>

<style scoped>

</style>