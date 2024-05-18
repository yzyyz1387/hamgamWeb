import VueRouter from 'vue-router'
import Resource from '../components/Resource'



export default new VueRouter({
    mode:'hash',
    routes: [
        { path: '/:picUrl', component: Resource },
        { path: '/', component: Resource }
    ]
})

