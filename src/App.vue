<template>
  <div id="app" class="main-app">
    <router-view path="$router.key" />
  </div>
</template>
<script>
import "./assets/css/main.css";

export default {
  name: 'App',
  mounted: function () {
    
  }
}
</script>
<style scoped>
#app {
  height: 100vh;
  width: 100vw;
  overflow-x: hidden;
  overflow-y: auto;
}
</style>