/**
 * URL 规范化与去重工具
 *
 * 两个不同用途的函数，别混用：
 *   - normalizeUrl：**入库**用。补全协议、统一 host 大小写、去掉默认端口与根路径尾斜杠，
 *     结果仍是一个可以直接打开的链接（保留 query 与 hash）。
 *   - getUrlKey：**比对**用。在 normalizeUrl 基础上再去掉协议、`www.`、尾斜杠与 hash，
 *     得到一个与书写形式无关的键，用来判断「这两个是不是同一个站点」。
 */

/** 判断字符串是否已带协议头 */
const HAS_PROTOCOL = /^[a-z][a-z\d+.-]*:\/\//i;

/**
 * 补全并规范化 URL
 *
 * - 缺少协议时补 `https://`
 * - host 统一小写（由 URL 解析器完成），去掉 `:80` / `:443` 这类默认端口
 * - 根路径的尾部斜杠去掉：`https://a.com/` → `https://a.com`
 * - 解析失败时退化为「补协议后的原文」，保证不丢用户输入
 */
export function normalizeUrl(input: string): string {
    const trimmed = (input ?? '').trim();
    if (!trimmed) return '';

    const withProtocol = HAS_PROTOCOL.test(trimmed) ? trimmed : `https://${trimmed}`;

    try {
        const parsed = new URL(withProtocol);
        const path = parsed.pathname === '/' ? '' : parsed.pathname;
        return `${parsed.protocol}//${parsed.host}${path}${parsed.search}${parsed.hash}`;
    } catch {
        return withProtocol;
    }
}

/**
 * 生成用于判重的 URL 键
 *
 * 忽略：协议（http / https）、`www.` 前缀、尾部斜杠、hash 片段、host 大小写。
 * 保留：端口（非默认时）、路径、query（`?id=1` 与 `?id=2` 是不同页面）。
 *
 * @returns 无法解析时返回空串（调用方应视为「不参与去重」）
 */
export function getUrlKey(input: string): string {
    const normalized = normalizeUrl(input);
    if (!normalized) return '';

    try {
        const parsed = new URL(normalized);
        const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
        const port = parsed.port ? `:${parsed.port}` : '';
        const path = parsed.pathname.replace(/\/+$/, '');
        return `${host}${port}${path}${parsed.search}`;
    } catch {
        return '';
    }
}

/** 判断两个 URL 是否指向同一站点（按 getUrlKey 比较） */
export function isSameUrl(left: string, right: string): boolean {
    const leftKey = getUrlKey(left);
    if (!leftKey) return false;
    return leftKey === getUrlKey(right);
}
