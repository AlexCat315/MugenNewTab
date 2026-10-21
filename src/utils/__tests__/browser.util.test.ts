import { describe, it, expect, afterEach, vi } from 'vitest';
import { isEdgeBrowser, getBrandLogo, LEGACY_LOGO, GIRL_LOGO } from '@/utils/browser.util';

/** 用给定的 UA 串（与可选 Client Hints）替换全局 navigator */
function stubNavigator(userAgent: string, brands?: string[]): void {
    vi.stubGlobal('navigator', {
        userAgent,
        userAgentData: brands ? { brands: brands.map((brand) => ({ brand })) } : undefined
    });
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('browser.util', () => {
    it('桌面版 Edge（Edg/）识别为 Edge', () => {
        stubNavigator(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0'
        );
        expect(isEdgeBrowser()).toBe(true);
    });

    it('Edge Android（EdgA/）与 Edge iOS（EdgiOS/）也识别为 Edge', () => {
        stubNavigator('Mozilla/5.0 (Linux; Android 14) Chrome/128.0.0.0 Mobile Safari/537.36 EdgA/128.0.0.0');
        expect(isEdgeBrowser()).toBe(true);

        stubNavigator('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) EdgiOS/128.0.0.0');
        expect(isEdgeBrowser()).toBe(true);
    });

    it('UA Client Hints 里的 Microsoft Edge 品牌优先命中', () => {
        stubNavigator('Mozilla/5.0 (Windows NT 10.0) Chrome/128.0.0.0 Safari/537.36', [
            'Chromium',
            'Microsoft Edge',
            'Not.A/Brand'
        ]);
        expect(isEdgeBrowser()).toBe(true);
    });

    it('Chrome / Safari / Firefox 不识别为 Edge', () => {
        stubNavigator(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
        );
        expect(isEdgeBrowser()).toBe(false);

        stubNavigator('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.0 Safari/605.1.15');
        expect(isEdgeBrowser()).toBe(false);

        stubNavigator('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:129.0) Gecko/20100101 Firefox/129.0');
        expect(isEdgeBrowser()).toBe(false);
    });

    it('Logo 分流：Edge 用旧 Logo，其余用新 Logo', () => {
        stubNavigator('Mozilla/5.0 (Windows NT 10.0) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0');
        expect(getBrandLogo()).toBe(LEGACY_LOGO);

        stubNavigator('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/128.0.0.0 Safari/537.36');
        expect(getBrandLogo()).toBe(GIRL_LOGO);
    });
});
