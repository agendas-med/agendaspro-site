import { createRouter, createWebHistory } from 'vue-router';

// import api from "../configs/api";

import indexPage from '../pages/indexPage.vue';

const routes = [
    {
        path: '/',
        name: 'Home',
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
        path: '/:pathMatch(.*)*',
        redirect: '/'
    }
];

const router = createRouter({
    history: createWebHistory('/'),
    routes,
});

export default router;