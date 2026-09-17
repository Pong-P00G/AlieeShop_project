import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/vue';
import { createRouter, createMemoryHistory } from 'vue-router';
import { createPinia, setActivePinia } from 'pinia';
import Login from '../../src/views/auth/Login.vue';

vi.mock('../../src/api/dashboardApi.js', () => ({
    dashboardAPI: {},
}));

const buildRouter = async (path) => {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/login', name: 'login', component: Login },
            { path: '/', name: 'home', component: { template: '<div />' } },
            { path: '/forgotPassword', name: 'forgotPassword', component: { template: '<div />' } },
            { path: '/register', name: 'register', component: { template: '<div />' } },
        ],
    });

    await router.push(path);
    await router.isReady();
    return router;
};

let pinia;

beforeEach(() => {
    vi.clearAllMocks();
    pinia = createPinia();
    setActivePinia(pinia);
});

describe('Login page — password changed notice', () => {
    it('explains why the user was signed out when redirected from a password change', async () => {
        const router = await buildRouter('/login?passwordChanged=1');

        render(Login, { global: { plugins: [pinia, router] } });

        expect(screen.getByText(/signed out on every device/)).toBeTruthy();
    });

    it('shows no notice on a normal visit', async () => {
        const router = await buildRouter('/login');

        render(Login, { global: { plugins: [pinia, router] } });

        expect(screen.queryByText(/signed out on every device/)).toBeNull();
    });
});
