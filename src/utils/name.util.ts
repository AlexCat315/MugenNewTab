/**
 * 名称规范化与判重工具
 *
 * 用于分类名、图标库分类名这类「按名字判重」的场景：
 * 忽略首尾空白、连续空白折叠、大小写差异与全角/半角差异。
 */

/**
 * 生成名称比对键
 *
 * - 首尾空白去掉，中间连续空白折叠为一个空格
 * - 统一转小写
 * - 全角空格（U+3000）视为普通空格
 */
export function normalizeNameKey(name: string): string {
    return (name ?? '')
        .replace(/\u3000/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

/** 判断两个名称是否视为同一个（按 normalizeNameKey 比较） */
export function isSameName(left: string, right: string): boolean {
    const leftKey = normalizeNameKey(left);
    if (!leftKey) return false;
    return leftKey === normalizeNameKey(right);
}
