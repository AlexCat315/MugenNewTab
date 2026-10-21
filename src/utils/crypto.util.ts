/**
 * WebCrypto 加解密工具
 *
 * 用 PBKDF2-SHA256 从用户口令派生出 AES-GCM 256 位密钥，对明文做认证加密。
 * 密文结构自带盐值与迭代次数，换设备时只要口令相同即可解密。
 *
 * 用途：跨设备同步登录凭据时，保证落到浏览器账号同步区（storage.sync）里的是密文，
 * 而不是明文的 GitHub / Gitee Token。
 */

/** 密文载荷结构 */
export interface EncryptedPayload {
    /** 载荷版本，便于后续升级算法 */
    v: 1;
    /** 对称加密算法 */
    alg: 'AES-GCM';
    /** 密钥派生算法 */
    kdf: 'PBKDF2-SHA256';
    /** PBKDF2 迭代次数 */
    iterations: number;
    /** 随机盐（base64） */
    salt: string;
    /** 初始向量（base64） */
    iv: string;
    /** 密文（base64） */
    data: string;
}

/** 默认 PBKDF2 迭代次数 */
export const DEFAULT_ITERATIONS = 210_000;

/** 口令最短长度 */
export const MIN_PASSPHRASE_LENGTH = 6;

/** 盐 / IV 字节长度 */
const SALT_BYTES = 16;
const IV_BYTES = 12;

/** 取 WebCrypto 实现，缺失时给出明确错误 */
function getSubtle(): SubtleCrypto {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) {
        throw new Error('当前环境不支持 WebCrypto，无法加密同步数据');
    }
    return subtle;
}

/** 字节数组转 base64 */
export function toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * 把 Uint8Array 交给 WebCrypto
 *
 * TS 5.7 起 Uint8Array 带上 ArrayBufferLike 泛型，与 BufferSource 要求的
 * ArrayBuffer 不完全兼容；这里统一收口成一次断言，避免每个调用点都写 as。
 */
function toBufferSource(bytes: Uint8Array): BufferSource {
    return bytes as unknown as BufferSource;
}

/** base64 转字节数组 */
export function fromBase64(value: string): Uint8Array {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/** 由口令与盐派生 AES-GCM 密钥 */
async function deriveKey(
    passphrase: string,
    salt: Uint8Array,
    iterations: number
): Promise<CryptoKey> {
    const subtle = getSubtle();
    const baseKey = await subtle.importKey(
        'raw',
        new TextEncoder().encode(passphrase),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return subtle.deriveKey(
        { name: 'PBKDF2', salt: toBufferSource(salt), iterations, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * 加密字符串
 *
 * @param plainText 待加密明文
 * @param passphrase 用户口令（至少 6 位）
 * @param iterations PBKDF2 迭代次数
 */
export async function encryptText(
    plainText: string,
    passphrase: string,
    iterations: number = DEFAULT_ITERATIONS
): Promise<EncryptedPayload> {
    if (!passphrase || passphrase.length < MIN_PASSPHRASE_LENGTH) {
        throw new Error(`同步密码至少 ${MIN_PASSPHRASE_LENGTH} 位`);
    }

    const subtle = getSubtle();
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const key = await deriveKey(passphrase, salt, iterations);

    const cipher = await subtle.encrypt(
        { name: 'AES-GCM', iv: toBufferSource(iv) },
        key,
        new TextEncoder().encode(plainText)
    );

    return {
        v: 1,
        alg: 'AES-GCM',
        kdf: 'PBKDF2-SHA256',
        iterations,
        salt: toBase64(salt),
        iv: toBase64(iv),
        data: toBase64(new Uint8Array(cipher))
    };
}

/**
 * 解密字符串
 *
 * @throws 密文格式不合法或口令错误时抛错
 */
export async function decryptText(
    payload: EncryptedPayload,
    passphrase: string
): Promise<string> {
    if (!isEncryptedPayload(payload)) {
        throw new Error('密文格式不正确，无法解密');
    }
    if (!passphrase) {
        throw new Error('同步密码不能为空');
    }

    const subtle = getSubtle();
    const key = await deriveKey(passphrase, fromBase64(payload.salt), payload.iterations);

    try {
        const plain = await subtle.decrypt(
            { name: 'AES-GCM', iv: toBufferSource(fromBase64(payload.iv)) },
            key,
            toBufferSource(fromBase64(payload.data))
        );
        return new TextDecoder().decode(plain);
    } catch {
        // AES-GCM 认证失败通常意味着口令不对
        throw new Error('同步密码不正确，无法解密');
    }
}

/** 判断任意值是否是本模块产出的密文载荷 */
export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const candidate = value as Partial<EncryptedPayload>;
    return (
        candidate.v === 1 &&
        candidate.alg === 'AES-GCM' &&
        candidate.kdf === 'PBKDF2-SHA256' &&
        typeof candidate.iterations === 'number' &&
        candidate.iterations > 0 &&
        typeof candidate.salt === 'string' &&
        typeof candidate.iv === 'string' &&
        typeof candidate.data === 'string'
    );
}
