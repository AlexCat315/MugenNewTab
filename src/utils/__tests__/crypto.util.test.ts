/**
 * crypto.util 单元测试
 *
 * 覆盖口令加密的往返、随机性、错误口令、参数校验与载荷识别。
 * 用低迭代次数跑用例，避免 21 万次 PBKDF2 拖慢测试。
 */

import { describe, it, expect } from 'vitest';
import {
    encryptText,
    decryptText,
    isEncryptedPayload,
    toBase64,
    fromBase64,
    DEFAULT_ITERATIONS,
    MIN_PASSPHRASE_LENGTH
} from '../crypto.util';

/** 测试用迭代次数（远低于生产值，只为验证流程） */
const TEST_ITERATIONS = 1000;

describe('crypto.util', () => {
    it('默认迭代次数与口令长度常量符合预期', () => {
        expect(DEFAULT_ITERATIONS).toBeGreaterThanOrEqual(200_000);
        expect(MIN_PASSPHRASE_LENGTH).toBe(6);
    });

    it('base64 往返不丢字节', () => {
        const bytes = new Uint8Array([0, 1, 127, 128, 255, 42]);
        expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes));
    });

    it('加密后可用同一口令解密回原文', async () => {
        const plain = JSON.stringify({ token: 'ghp_secret_token_value', provider: 'github' });
        const payload = await encryptText(plain, 'my-passphrase', TEST_ITERATIONS);

        expect(payload.v).toBe(1);
        expect(payload.alg).toBe('AES-GCM');
        expect(payload.kdf).toBe('PBKDF2-SHA256');
        expect(payload.iterations).toBe(TEST_ITERATIONS);

        const restored = await decryptText(payload, 'my-passphrase');
        expect(restored).toBe(plain);
    });

    it('密文中不含明文 token', async () => {
        const token = 'ghp_plaintext_must_not_leak';
        const payload = await encryptText(JSON.stringify({ token }), 'my-passphrase', TEST_ITERATIONS);
        const serialized = JSON.stringify(payload);

        expect(serialized).not.toContain(token);
        // 密文本身是 base64，不应出现明文字符串
        expect(payload.data).not.toContain('ghp_');
    });

    it('同一明文两次加密产出不同密文（随机盐与 IV）', async () => {
        const plain = 'same-content';
        const first = await encryptText(plain, 'my-passphrase', TEST_ITERATIONS);
        const second = await encryptText(plain, 'my-passphrase', TEST_ITERATIONS);

        expect(first.salt).not.toBe(second.salt);
        expect(first.iv).not.toBe(second.iv);
        expect(first.data).not.toBe(second.data);
    });

    it('口令错误时抛出可读错误', async () => {
        const payload = await encryptText('secret', 'right-passphrase', TEST_ITERATIONS);

        await expect(decryptText(payload, 'wrong-passphrase')).rejects.toThrow('同步密码不正确');
    });

    it('口令过短时拒绝加密', async () => {
        await expect(encryptText('secret', '123', TEST_ITERATIONS)).rejects.toThrow('同步密码至少');
        await expect(encryptText('secret', '', TEST_ITERATIONS)).rejects.toThrow('同步密码至少');
    });

    it('解密时口令为空直接报错', async () => {
        const payload = await encryptText('secret', 'right-passphrase', TEST_ITERATIONS);
        await expect(decryptText(payload, '')).rejects.toThrow('同步密码不能为空');
    });

    it('isEncryptedPayload 只认本模块产出的结构', async () => {
        const payload = await encryptText('secret', 'right-passphrase', TEST_ITERATIONS);

        expect(isEncryptedPayload(payload)).toBe(true);
        expect(isEncryptedPayload(null)).toBe(false);
        expect(isEncryptedPayload('ciphertext')).toBe(false);
        expect(isEncryptedPayload({ ...payload, v: 2 })).toBe(false);
        expect(isEncryptedPayload({ ...payload, alg: 'AES-CBC' })).toBe(false);
        expect(isEncryptedPayload({ ...payload, iterations: 0 })).toBe(false);
        expect(isEncryptedPayload({ ...payload, salt: undefined })).toBe(false);
    });
});
