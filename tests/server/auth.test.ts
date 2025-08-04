import { describe, test, expect, beforeEach } from '@jest/globals';
import { hashPassword, comparePasswords } from '../../server/auth';

// Mock bcrypt functionality since we're using scrypt
const crypto = require('crypto');

describe('Authentication', () => {
  describe('Password Hashing', () => {
    test('should hash password successfully', async () => {
      const password = 'testpassword123';
      const hashed = await hashPassword(password);
      
      expect(hashed).toBeDefined();
      expect(hashed).not.toBe(password);
      expect(hashed).toContain('.');
      
      // Check format: hash.salt
      const parts = hashed.split('.');
      expect(parts).toHaveLength(2);
      expect(parts[0]).toHaveLength(128); // 64 bytes * 2 (hex)
      expect(parts[1]).toHaveLength(32);  // 16 bytes * 2 (hex)
    });

    test('should generate different hashes for same password', async () => {
      const password = 'testpassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });

    test('should hash empty password', async () => {
      const password = '';
      const hashed = await hashPassword(password);
      
      expect(hashed).toBeDefined();
      expect(hashed).toContain('.');
    });
  });

  describe('Password Comparison', () => {
    test('should verify correct password', async () => {
      const password = 'testpassword123';
      const hashed = await hashPassword(password);
      
      const isValid = await comparePasswords(password, hashed);
      
      expect(isValid).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const password = 'testpassword123';
      const wrongPassword = 'wrongpassword456';
      const hashed = await hashPassword(password);
      
      const isValid = await comparePasswords(wrongPassword, hashed);
      
      expect(isValid).toBe(false);
    });

    test('should reject password with different case', async () => {
      const password = 'TestPassword123';
      const wrongPassword = 'testpassword123';
      const hashed = await hashPassword(password);
      
      const isValid = await comparePasswords(wrongPassword, hashed);
      
      expect(isValid).toBe(false);
    });

    test('should handle empty password comparison', async () => {
      const password = '';
      const hashed = await hashPassword(password);
      
      const isValid = await comparePasswords('', hashed);
      
      expect(isValid).toBe(true);
    });

    test('should handle malformed hash', async () => {
      const password = 'testpassword';
      const malformedHash = 'invalid-hash-format';
      
      // Should not throw but return false
      const isValid = await comparePasswords(password, malformedHash);
      
      expect(isValid).toBe(false);
    });
  });
});
