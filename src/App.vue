<template>
  <div>
    <!-- <Resource />   -->
    <router-view></router-view>
    <Footer/>
  </div>
</template>

<script>
    import Resource from './components/Resource'
    import Footer from "@/components/Footer.vue";


    export default {
            name: 'App',
            components:{
                Resource,
                Footer
                
            },
    }
</script>

<style>

</style>