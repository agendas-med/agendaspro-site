import Vue from 'vue';
import VueRouter from 'vue-router';

import api from "../configs/api";

Vue.use(VueRouter);

import indexPage from '../pages/indexPage.vue';

const routes = [
    {
        path: '/',
        component: indexPage,
        meta: {
            title: "AgendasPRO",
            metaTags: [
                { name: "description", content: "Agende agora - AgendasPRO" },
                { name: "og:description", content: "Agendamento de serviços de forma rápida e facilitada" }
            ]
        }
    },
    {
        path: '',
        redirect: '/'
    },
    {
        path: "*",
        redirect: "/"
    }
];

const router = new VueRouter({
    routes,
    mode: 'history'
});

export default router;
