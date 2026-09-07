import { describe, it, expect, vi } from 'vitest';
import { ProbeImage, probeIconUrl } from './iconProbe';

/**
 * The image is injected rather than mocked globally, because the point of these
 * tests is the mapping from load/error/silence to true/false/undefined, and
 * that mapping is what decides whether the user is warned. A jsdom Image would
 * never fire either event, so it could not tell the three apart.
 */
const fake = () => {
    const image: ProbeImage & { assigned: string[] } = {
        onload: null,
        onerror: null,
        src: '',
        assigned: [],
    };
    return image;
};

/** Lets the promise's executor run before the event is fired. */
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('probeIconUrl', () => {
    it('says nothing about an inline icon, and never loads one', async () => {
        // Every data: URL in a rule was drawn to a canvas in this same page
        // before it was saved, so there is nothing to find out and no reason to
        // spend a request on it.
        let made = 0;
        const result = await probeIconUrl('data:image/png;base64,AAAA', {
            makeImage: () => { made++; return fake(); },
        });
        expect(result).toBeUndefined();
        expect(made).toBe(0);
    });

    it('says nothing about an empty address', async () => {
        let made = 0;
        const result = await probeIconUrl('', { makeImage: () => { made++; return fake(); } });
        expect(result).toBeUndefined();
        expect(made).toBe(0);
    });

    it('makes no claim about an http address, which it cannot load at all', async () => {
        // Measured in a real extension page: an insecure subresource is refused
        // under MV3, so probing http would report every working http icon as
        // broken. It must decline instead, and must not spend a request.
        let made = 0;
        const probe = (url: string) => probeIconUrl(url, { makeImage: () => { made++; return fake(); } });

        await expect(probe('http://127.0.0.1:8899/blue.png')).resolves.toBeUndefined();
        await expect(probe('http://intranet.example/icon.png')).resolves.toBeUndefined();
        expect(made).toBe(0);
    });

    it('makes no claim about an address in some other scheme', async () => {
        let made = 0;
        const probe = (url: string) => probeIconUrl(url, { makeImage: () => { made++; return fake(); } });
        await expect(probe('ftp://example.com/icon.png')).resolves.toBeUndefined();
        await expect(probe('chrome-extension://abc/icon.png')).resolves.toBeUndefined();
        expect(made).toBe(0);
    });

    it('probes https whatever the case of the scheme', async () => {
        const image = fake();
        const pending = probeIconUrl('HTTPS://cdn.example.com/icon.png', { makeImage: () => image });
        await tick();
        image.onload?.();
        await expect(pending).resolves.toBe(true);
    });

    it('says nothing when the page has no Image constructor at all', async () => {
        // The unit-test environment is exactly this case, and so is any caller
        // outside a document. It must decline to guess rather than throw.
        expect(typeof Image).toBe('undefined');
        await expect(probeIconUrl('https://cdn.example.com/icon.png')).resolves.toBeUndefined();
    });

    it('reports true when the address loads', async () => {
        const image = fake();
        const pending = probeIconUrl('https://cdn.example.com/icon.png', { makeImage: () => image });
        await tick();
        expect(image.src).toBe('https://cdn.example.com/icon.png');
        image.onload?.();
        await expect(pending).resolves.toBe(true);
    });

    it('reports false when the address errors', async () => {
        const image = fake();
        const pending = probeIconUrl('https://cdn.example.com/missing.png', { makeImage: () => image });
        await tick();
        image.onerror?.();
        await expect(pending).resolves.toBe(false);
    });

    it('reports undefined rather than false when the address is merely slow', async () => {
        // The distinction the whole feature rests on: a slow host must not be
        // reported to the user as a broken address.
        const image = fake();
        const result = await probeIconUrl('https://slow.example.com/icon.png', {
            makeImage: () => image,
            timeoutMs: 5,
        });
        expect(result).toBeUndefined();
    });

    it('ignores a load that arrives after the timeout, keeping the first answer', async () => {
        const image = fake();
        const pending = probeIconUrl('https://slow.example.com/icon.png', {
            makeImage: () => image,
            timeoutMs: 5,
        });
        await expect(pending).resolves.toBeUndefined();
        // The handlers are detached, so a late event cannot re-resolve.
        expect(image.onload).toBeNull();
        expect(image.onerror).toBeNull();
    });

    it('ignores a second event after the first, so the result cannot flip', async () => {
        const image = fake();
        const pending = probeIconUrl('https://cdn.example.com/icon.png', { makeImage: () => image });
        await tick();
        const load = image.onload;
        image.onload?.();
        image.onerror?.();
        load?.();
        await expect(pending).resolves.toBe(true);
    });

    it('clears its timer once settled, so a finished probe holds nothing open', async () => {
        // The other half of "the first answer is the only answer". Without this
        // every probe would keep a timer and its closure alive for the full
        // budget after the answer was already known.
        vi.useFakeTimers();
        try {
            const image = fake();
            const pending = probeIconUrl('https://cdn.example.com/icon.png', { makeImage: () => image });
            expect(vi.getTimerCount()).toBe(1);
            image.onload?.();
            await expect(pending).resolves.toBe(true);
            expect(vi.getTimerCount()).toBe(0);
        } finally {
            vi.useRealTimers();
        }
    });

    it('detaches its handlers once settled, so nothing is left holding the image', async () => {
        const image = fake();
        const pending = probeIconUrl('https://cdn.example.com/icon.png', { makeImage: () => image });
        await tick();
        image.onload?.();
        await pending;
        expect(image.onload).toBeNull();
        expect(image.onerror).toBeNull();
    });
});
