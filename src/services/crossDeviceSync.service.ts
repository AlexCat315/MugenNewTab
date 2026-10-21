/**
 * 跨设备登录状态同步
 *
 * 把云同步的登录凭据（Token + 平台）用用户口令加密后写入 storage.sync，
 * 登录同一浏览器账号的其他设备可解密还原，无需重新输入 Token。
 *
 * 安全边界：
 *   - 落到同步区的永远是密文（AES-GCM），浏览器账号里看不到明文 Token；
 *   - 口令本身只存在本机 storage.local，不上传；
 *   - 本机本来就存着明文 Token，因此口令不落盘并不会带来额外风险，
 *     这里选择落盘换取「无需每次输入口令」的体验。
 */

import { storageManager } from '@/services/storage.service';
import { syncGet, syncSet, syncRemove } from '@/services/syncStorage.service';
import {
    encryptText,
    decryptText,
    isEncryptedPayload,
    MIN_PASSPHRASE_LENGTH
} from '@/utils/crypto.util';

/** 本机：是否启用跨设备同步 */
const LOCAL_ENABLED_KEY = 'appNavigator_crossDevice_enabled';
/** 本机：加密口令（不上传） */
const LOCAL_PASSPHRASE_KEY = 'appNavigator_crossDevice_passphrase';
/** 同步区：加密后的登录凭据 */
const REMOTE_AUTH_KEY = 'mugen_cross_device_auth';

/** 需要跨设备同步的登录凭据 */
export interface CrossDeviceAuth {
    /** 平台 Token */
    token: string;
    /** 平台标识：github / gitee */
    provider: string;
}

/** 跨设备同步的当前状态 */
export interface CrossDeviceState {
    /** 是否已启用 */
    enabled: boolean;
    /** 本机是否已保存口令 */
    hasPassphrase: boolean;
}

/** 读取当前启用状态 */
export async function getCrossDeviceState(): Promise<CrossDeviceState> {
    const [enabled, passphrase] = await Promise.all([
        storageManager.get(LOCAL_ENABLED_KEY),
        storageManager.get(LOCAL_PASSPHRASE_KEY)
    ]);
    return {
        enabled: enabled === true,
        hasPassphrase: typeof passphrase === 'string' && passphrase.length >= MIN_PASSPHRASE_LENGTH
    };
}

/** 是否已启用跨设备同步 */
export async function isCrossDeviceEnabled(): Promise<boolean> {
    return (await getCrossDeviceState()).enabled;
}

/** 同步区是否已有其他设备推送的加密凭据（无需口令即可判断） */
export async function hasRemoteCrossDeviceAuth(): Promise<boolean> {
    return isEncryptedPayload(await syncGet(REMOTE_AUTH_KEY));
}

/**
 * 启用跨设备同步
 *
 * @param passphrase 加密口令（至少 6 位），后续换设备需输入同一口令
 * @param auth 当前登录凭据；为空时只保存开关与口令，等下次登录再推送
 *
 * 注意：`auth` 为空时**不会**删除同步区已有密文——新设备首次启用时
 * 正是靠这份密文还原登录状态，删掉就无从恢复。清理只在登出 / 关闭开关时发生。
 */
export async function enableCrossDevice(
    passphrase: string,
    auth?: CrossDeviceAuth | null
): Promise<void> {
    if (!passphrase || passphrase.length < MIN_PASSPHRASE_LENGTH) {
        throw new Error(`同步密码至少 ${MIN_PASSPHRASE_LENGTH} 位`);
    }

    // 先加密一次验证口令可用（同时验证 WebCrypto 是否可用）
    const payload = await encryptText(JSON.stringify(auth ?? null), passphrase);

    await storageManager.setMany({
        [LOCAL_ENABLED_KEY]: true,
        [LOCAL_PASSPHRASE_KEY]: passphrase
    });

    if (auth?.token) {
        await syncSet(REMOTE_AUTH_KEY, payload);
    }
}

/**
 * 在新设备上凭口令还原登录状态
 *
 * 成功后会把「开关 + 口令」落到本机，之后的自动推送即可复用。
 *
 * @throws 口令错误时抛「同步密码不正确，无法解密」
 */
export async function restoreCrossDeviceAuth(
    passphrase: string
): Promise<CrossDeviceAuth | null> {
    if (!passphrase || passphrase.length < MIN_PASSPHRASE_LENGTH) {
        throw new Error(`同步密码至少 ${MIN_PASSPHRASE_LENGTH} 位`);
    }

    const raw = await syncGet(REMOTE_AUTH_KEY);
    if (!isEncryptedPayload(raw)) {
        return null;
    }

    const plain = await decryptText(raw, passphrase);
    let parsed: CrossDeviceAuth | null = null;
    try {
        parsed = JSON.parse(plain) as CrossDeviceAuth | null;
    } catch {
        return null;
    }

    if (!parsed || typeof parsed.token !== 'string' || !parsed.token) {
        return null;
    }

    await storageManager.setMany({
        [LOCAL_ENABLED_KEY]: true,
        [LOCAL_PASSPHRASE_KEY]: passphrase
    });

    return {
        token: parsed.token,
        provider: typeof parsed.provider === 'string' ? parsed.provider : 'github'
    };
}

/** 关闭跨设备同步：清除本机口令与同步区密文 */
export async function disableCrossDevice(): Promise<void> {
    await storageManager.setMany({
        [LOCAL_ENABLED_KEY]: false,
        [LOCAL_PASSPHRASE_KEY]: null
    });
    await syncRemove(REMOTE_AUTH_KEY);
}

/**
 * 推送登录凭据到同步区
 *
 * @param auth 为 null 表示已登出，需要清掉同步区的密文
 */
export async function pushCrossDeviceAuth(auth: CrossDeviceAuth | null): Promise<void> {
    const state = await getCrossDeviceState();
    if (!state.enabled) {
        return;
    }

    if (!auth?.token) {
        await syncRemove(REMOTE_AUTH_KEY);
        return;
    }

    const passphrase = await storageManager.get(LOCAL_PASSPHRASE_KEY);
    if (typeof passphrase !== 'string' || passphrase.length < MIN_PASSPHRASE_LENGTH) {
        // 口令丢失（例如清了浏览器数据）时无法加密，跳过推送
        return;
    }

    const payload = await encryptText(JSON.stringify(auth), passphrase);
    await syncSet(REMOTE_AUTH_KEY, payload);
}

/**
 * 从同步区拉取并解密登录凭据
 *
 * @returns 解密后的凭据；未启用、无密文或解密失败时返回 null
 */
export async function pullCrossDeviceAuth(): Promise<CrossDeviceAuth | null> {
    const state = await getCrossDeviceState();
    if (!state.enabled || !state.hasPassphrase) {
        return null;
    }

    const raw = await syncGet(REMOTE_AUTH_KEY);
    if (!isEncryptedPayload(raw)) {
        return null;
    }

    const passphrase = await storageManager.get(LOCAL_PASSPHRASE_KEY);
    if (typeof passphrase !== 'string') {
        return null;
    }

    const plain = await decryptText(raw, passphrase);
    const parsed = JSON.parse(plain) as CrossDeviceAuth | null;
    if (!parsed || typeof parsed.token !== 'string' || !parsed.token) {
        return null;
    }

    return {
        token: parsed.token,
        provider: typeof parsed.provider === 'string' ? parsed.provider : 'github'
    };
}
