/**
 * name.util 单元测试
 *
 * 覆盖名称判重键对空白、大小写、全角空格的归一处理。
 */

import { describe, it, expect } from 'vitest';
import { normalizeNameKey, isSameName } from '../name.util';

describe('normalizeNameKey', () => {
    it('去掉首尾空白并转小写', () => {
        expect(normalizeNameKey('  开发工具  ')).toBe('开发工具');
        expect(normalizeNameKey('Reading List')).toBe('reading list');
    });

    it('中间连续空白折叠为一个空格', () => {
        expect(normalizeNameKey('a    b\t c')).toBe('a b c');
    });

    it('全角空格视为普通空格', () => {
        expect(normalizeNameKey('阅读\u3000列表')).toBe('阅读 列表');
    });

    it('空值返回空串', () => {
        expect(normalizeNameKey('')).toBe('');
        expect(normalizeNameKey('   ')).toBe('');
        expect(normalizeNameKey(undefined as unknown as string)).toBe('');
    });
});

describe('isSameName', () => {
    it('大小写与空白差异视为同名', () => {
        expect(isSameName('Reading List', ' reading   list ')).toBe(true);
        expect(isSameName('开发工具', '开发工具 ')).toBe(true);
    });

    it('不同名称返回 false', () => {
        expect(isSameName('开发工具', '效率工具')).toBe(false);
    });

    it('任一为空返回 false', () => {
        expect(isSameName('', '开发工具')).toBe(false);
        expect(isSameName('开发工具', '   ')).toBe(false);
    });
});
