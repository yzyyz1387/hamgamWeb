import Vue from 'vue'
import App from './App.vue'
import VueRouter from 'vue-router'
import router from './router'
import ElementUI from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css';
import VueLazyload from 'vue-lazyload';


Vue.config.productionTip = false
Vue.use(VueRouter)
Vue.use(ElementUI);
Vue.use(VueLazyload, {
  preLoad: 1.3,
  error: require('@/assets/crying_img.png'),
  loading: require('@/assets/loading.gif'),
  attempt: 1
});

new Vue({
  el: '#app',
  comments: { App },
  render: h => h(App),
  router: router
})
