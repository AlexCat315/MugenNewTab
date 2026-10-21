/**
 * 浏览器识别与品牌资源
 *
 * 目前只用于品牌 Logo 的按浏览器分流：
 * Edge 继续使用旧的 mugen.png，其余浏览器使用 logo_girl 系列（按尺寸预生成）。
 */

/** 旧版 Logo（Edge 使用） */
export const LEGACY_LOGO = '/image/logo/mugen.png';

/** 新版 Logo（除 Edge 外的浏览器使用） */
export const GIRL_LOGO = '/image/logo/logo_girl-256.png';

/** 判断当前是否为 Microsoft Edge（含 Edge for Android / iOS 与旧版 Edge） */
export function isEdgeBrowser(): boolean {
    if (typeof navigator === 'undefined') {
        return false;
    }

    // 新版 Chromium 优先看 UA Client Hints，品牌名比 UA 串更可靠
    const uaData = (
        navigator as Navigator & {
            userAgentData?: { brands?: Array<{ brand?: string }> };
        }
    ).userAgentData;

    if (uaData?.brands?.some((item) => /Microsoft Edge/i.test(item.brand ?? ''))) {
        return true;
    }

    // 兜底看 UA：Edg/（桌面）、EdgA/（Android）、EdgiOS/（iOS）、Edge/（旧版）
    const userAgent = navigator.userAgent ?? '';
    return /\bEdg(e|A|iOS)?\//.test(userAgent);
}

/**
 * 取当前浏览器应使用的品牌 Logo。
 *
 * Edge → 旧 Logo；其他浏览器 → 新 Logo。
 */
export function getBrandLogo(): string {
    return isEdgeBrowser() ? LEGACY_LOGO : GIRL_LOGO;
}
