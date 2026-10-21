/**
 * chrome.storage.sync 封装（跨设备同步区）
 *
 * 与 storage.service 的本地存储相互独立：
 *   - 扩展环境：走浏览器账号同步区 storage.sync，登录同一账号的其他设备可见；
 *   - 非扩展环境（网页版调试）：降级为 localStorage 加前缀模拟，仅本机可见。
 *
 * 注意：storage.sync 有配额限制（单条 8KB / 总计约 100KB），只适合存放加密后的短凭据。
 */

/** 非扩展环境的 localStorage 前缀 */
const LOCAL_PREFIX = '__mnt_sync__:';

interface SyncAreaLike {
    get: (...args: unknown[]) => unknown;
    set: (...args: unknown[]) => unknown;
    remove: (...args: unknown[]) => unknown;
}

interface WindowWithSyncStorage {
    chrome?: { storage?: { sync?: SyncAreaLike }; runtime?: { lastError?: { message?: string } } };
    browser?: { storage?: { sync?: SyncAreaLike } };
}

function getWindow(): WindowWithSyncStorage | null {
    return typeof window === 'undefined' ? null : (window as unknown as WindowWithSyncStorage);
}

/** 取原生 storage.sync 对象，不存在时返回 null */
function getNativeSyncArea(): SyncAreaLike | null {
    const win = getWindow();
    return win?.browser?.storage?.sync ?? win?.chrome?.storage?.sync ?? null;
}

/** Firefox 的 browser.* 直接返回 Promise，chrome.* 需要回调 */
function isPromiseStyle(): boolean {
    return !!getWindow()?.browser?.storage?.sync;
}

/** 是否使用浏览器原生同步区（否则是 localStorage 降级） */
export function isNativeSyncStorage(): boolean {
    return getNativeSyncArea() !== null;
}

function localKey(key: string): string {
    return `${LOCAL_PREFIX}${key}`;
}

/** 读取单个同步项 */
export async function syncGet(key: string): Promise<unknown | null> {
    const area = getNativeSyncArea();
    if (!area) {
        const raw = window.localStorage.getItem(localKey(key));
        if (raw === null) return null;
        try {
            return JSON.parse(raw);
        } catch {
            return raw;
        }
    }

    if (isPromiseStyle()) {
        const items = (await (area.get as (keys: string) => Promise<Record<string, unknown>>)(key)) ?? {};
        return items[key] ?? null;
    }

    return new Promise((resolve, reject) => {
        (area.get as (keys: string, cb: (items: Record<string, unknown>) => void) => void)(
            key,
            (items) => {
                const lastError = getWindow()?.chrome?.runtime?.lastError;
                if (lastError) {
                    reject(new Error(lastError.message || '读取同步存储失败'));
                    return;
                }
                resolve(items?.[key] ?? null);
            }
        );
    });
}

/** 写入单个同步项 */
export async function syncSet(key: string, value: unknown): Promise<void> {
    const area = getNativeSyncArea();
    if (!area) {
        window.localStorage.setItem(localKey(key), JSON.stringify(value));
        return;
    }

    if (isPromiseStyle()) {
        await (area.set as (items: Record<string, unknown>) => Promise<void>)({ [key]: value });
        return;
    }

    await new Promise<void>((resolve, reject) => {
        (area.set as (items: Record<string, unknown>, cb: () => void) => void)(
            { [key]: value },
            () => {
                const lastError = getWindow()?.chrome?.runtime?.lastError;
                if (lastError) {
                    reject(new Error(lastError.message || '写入同步存储失败'));
                    return;
                }
                resolve();
            }
        );
    });
}

/** 删除单个同步项 */
export async function syncRemove(key: string): Promise<void> {
    const area = getNativeSyncArea();
    if (!area) {
        window.localStorage.removeItem(localKey(key));
        return;
    }

    if (isPromiseStyle()) {
        await (area.remove as (keys: string) => Promise<void>)(key);
        return;
    }

    await new Promise<void>((resolve, reject) => {
        (area.remove as (keys: string, cb: () => void) => void)(key, () => {
            const lastError = getWindow()?.chrome?.runtime?.lastError;
            if (lastError) {
                reject(new Error(lastError.message || '删除同步存储失败'));
                return;
            }
            resolve();
        });
    });
}
