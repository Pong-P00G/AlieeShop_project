import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { validateRegister } from '../src/middleware/validationMiddleWare.js';

// Echoes the body the route sees *after* validation, so a test can assert what
// was accepted vs. stripped.
const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.post('/register', validateRegister, (req, res) => res.status(200).json(req.body));
    return app;
};

const validBody = () => ({
    username: 'validuser',
    email: 'valid@example.com',
    password: 'password123',
    first_name: 'Valid',
    last_name: 'User',
});

describe('validateRegister', () => {
    it('accepts a valid registration without role_id', async () => {
        const res = await request(buildApp()).post('/register').send(validBody());

        expect(res.status).toBe(200);
        expect(res.body.role_id).toBeUndefined();
    });

    it('accepts role_id but strips it before the controller', async () => {
        const res = await request(buildApp())
            .post('/register')
            .send({ ...validBody(), role_id: 1 });

        expect(res.status).toBe(200);
        // A client must never be able to smuggle in a privileged role.
        expect(res.body.role_id).toBeUndefined();
    });

    it('still rejects genuinely invalid payloads', async () => {
        const res = await request(buildApp())
            .post('/register')
            .send({ ...validBody(), password: 'short' });

        expect(res.status).toBe(400);
    });
});
