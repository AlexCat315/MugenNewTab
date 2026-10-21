/**
 * url.util 单元测试
 *
 * 覆盖两个不同用途的函数：normalizeUrl（入库格式）与 getUrlKey（判重键）。
 */

import { describe, it, expect } from 'vitest';
import { normalizeUrl, getUrlKey, isSameUrl } from '../url.util';

describe('normalizeUrl', () => {
    it('缺少协议时补 https://', () => {
        expect(normalizeUrl('github.com')).toBe('https://github.com');
        expect(normalizeUrl('  github.com  ')).toBe('https://github.com');
    });

    it('保留已有协议', () => {
        expect(normalizeUrl('http://example.com')).toBe('http://example.com');
        expect(normalizeUrl('https://example.com')).toBe('https://example.com');
    });

    it('host 统一小写', () => {
        expect(normalizeUrl('https://GitHub.COM/Path')).toBe('https://github.com/Path');
    });

    it('去掉根路径的尾斜杠，保留子路径', () => {
        expect(normalizeUrl('https://a.com/')).toBe('https://a.com');
        expect(normalizeUrl('https://a.com/docs/')).toBe('https://a.com/docs/');
    });

    it('去掉默认端口', () => {
        expect(normalizeUrl('https://a.com:443/')).toBe('https://a.com');
        expect(normalizeUrl('http://a.com:80/')).toBe('http://a.com');
        expect(normalizeUrl('https://a.com:8443/')).toBe('https://a.com:8443');
    });

    it('保留 query 与 hash', () => {
        expect(normalizeUrl('https://a.com/?q=1#top')).toBe('https://a.com?q=1#top');
    });

    it('空值返回空串', () => {
        expect(normalizeUrl('')).toBe('');
        expect(normalizeUrl('   ')).toBe('');
        expect(normalizeUrl(undefined as unknown as string)).toBe('');
    });

    it('无法解析时退化为补协议后的原文', () => {
        expect(normalizeUrl('not a url')).toBe('https://not a url');
    });
});

describe('getUrlKey', () => {
    it('协议、www、尾斜杠、hash 不同的地址得到同一个键', () => {
        const key = getUrlKey('https://www.a.com/');
        expect(getUrlKey('http://a.com')).toBe(key);
        expect(getUrlKey('https://a.com')).toBe(key);
        expect(getUrlKey('https://WWW.A.com/#section')).toBe(key);
        expect(getUrlKey('a.com')).toBe(key);
    });

    it('路径不同得到不同键', () => {
        expect(getUrlKey('https://a.com/docs')).not.toBe(getUrlKey('https://a.com'));
    });

    it('query 不同得到不同键', () => {
        expect(getUrlKey('https://a.com/?id=1')).not.toBe(getUrlKey('https://a.com/?id=2'));
    });

    it('非默认端口保留在键中', () => {
        expect(getUrlKey('https://a.com:8443')).not.toBe(getUrlKey('https://a.com'));
    });

    it('空值与无效值返回空串', () => {
        expect(getUrlKey('')).toBe('');
        expect(getUrlKey('   ')).toBe('');
    });
});

describe('isSameUrl', () => {
    it('同一站点的不同写法返回 true', () => {
        expect(isSameUrl('https://bilibili.com', 'http://www.bilibili.com/')).toBe(true);
    });

    it('不同站点返回 false', () => {
        expect(isSameUrl('https://a.com', 'https://b.com')).toBe(false);
    });

    it('任一为空返回 false', () => {
        expect(isSameUrl('', 'https://a.com')).toBe(false);
        expect(isSameUrl('https://a.com', '')).toBe(false);
    });
});
