<template>
  <div>
    <!-- <Resource />   -->
    <router-view></router-view>
  </div>
</template>

<script>
    import Resource from './components/Resource'


    export default {
            name: 'App',
            components:{
                Resource
                
            },
    }
</script>

<style>

</style>