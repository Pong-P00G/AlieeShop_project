import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Import the real axios instance so the test exercises axios' actual request
// transformation — the bug being guarded against lives there, not in userApi.
const { default: api } = await import('../../src/api/api.js');
const { userAPI } = await import('../../src/api/userApi.js');

const originalAdapter = api.defaults.adapter;
let captured;

beforeEach(() => {
    captured = null;
    // Capture the config axios hands to the adapter (after transformRequest has
    // already run) instead of performing a network request.
    api.defaults.adapter = (config) => {
        captured = config;
        return Promise.resolve({
            data: { success: true, data: { profile_picture_url: 'https://cdn.test/profile/x.png' } },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
        });
    };
});

afterEach(() => {
    api.defaults.adapter = originalAdapter;
});

const makeFile = () =>
    new File([new Blob(['fake-bytes'], { type: 'image/png' })], 'avatar.png', { type: 'image/png' });

describe('userAPI.uploadProfilePicture', () => {
    it('posts a multipart body rather than JSON-serialising the FormData', async () => {
        const file = makeFile();

        await userAPI.uploadProfilePicture(file);

        // The regression: a JSON Content-Type made axios turn FormData into a
        // JSON string, so the server received no image at all.
        expect(captured.data).toBeInstanceOf(FormData);
        expect(typeof captured.data).not.toBe('string');
        expect(captured.data.get('image')).toBe(file);
    });

    it('does not advertise a JSON content type on the upload', async () => {
        await userAPI.uploadProfilePicture(makeFile());

        const contentType = captured.headers.getContentType?.() ?? captured.headers['Content-Type'];
        expect(contentType).not.toMatch(/application\/json/);
    });
});
