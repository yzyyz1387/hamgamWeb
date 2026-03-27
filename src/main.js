import { createApp } from 'vue'
import 'mdui/mdui.css'
import 'mdui'
import './assets/styles.css'
import '@imengyu/vue3-context-menu/lib/vue3-context-menu.css'
import ContextMenu from '@imengyu/vue3-context-menu'
import App from './App.vue'
import router from './router'
import { pinia } from './stores'

const app = createApp(App)
app.use(pinia)
app.use(router)
app.use(ContextMenu)
app.mount('#app')
