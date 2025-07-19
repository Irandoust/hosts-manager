import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Utils } from '../src/utils';
import * as fs from 'fs';
import * as vscode from 'vscode';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    promises: {
      stat: vi.fn(),
      access: vi.fn(),
      readdir: vi.fn(),
      mkdir: vi.fn(),
      writeFile: vi.fn(),
      unlink: vi.fn(),
    },
  };
});

vi.mock('vscode', () => ({
  window: {
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
  },
}));

describe('Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(Utils.formatFileSize(0)).toBe('0 B');
      expect(Utils.formatFileSize(1024)).toBe('1 KB');
      expect(Utils.formatFileSize(1048576)).toBe('1 MB');
    });
  });

  describe('validateIPAddress', () => {
    it('should validate correct IP addresses', () => {
      expect(Utils.validateIPAddress('192.168.1.1')).toBe(true);
      expect(Utils.validateIPAddress('255.255.255.255')).toBe(true);
    });

    it('should invalidate incorrect IP addresses', () => {
      expect(Utils.validateIPAddress('999.999.999.999')).toBe(false);
      expect(Utils.validateIPAddress('abc.def.ghi.jkl')).toBe(false);
    });
  });

  describe('validateHostname', () => {
    it('should validate proper hostnames', () => {
      expect(Utils.validateHostname('localhost')).toBe(true);
      expect(Utils.validateHostname('example.com')).toBe(true);
    });

    it('should invalidate empty or malformed hostnames', () => {
      expect(Utils.validateHostname('')).toBe(false);
      expect(Utils.validateHostname('-invalid')).toBe(false);
    });
  });

  describe('parseHostsLine', () => {
    it('should parse a valid hosts line', () => {
      const line = '127.0.0.1 localhost # Local loopback';
      const result = Utils.parseHostsLine(line);
      expect(result).toEqual({
        ip: '127.0.0.1',
        hostname: 'localhost',
        comment: 'Local loopback',
        isEnabled: true,
      });
    });

    it('should return null for comment lines', () => {
      expect(Utils.parseHostsLine('# 127.0.0.1 localhost')).toBeNull();
    });

    it('should return null for empty lines', () => {
      expect(Utils.parseHostsLine('')).toBeNull();
    });
  });
});
