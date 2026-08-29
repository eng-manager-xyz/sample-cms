import { describe, expect, test } from 'bun:test';
import { canonicalHash, canonicalJson, sha256Hex } from './hash';

describe('canonical hashing', () => {
  test('implements the standard SHA-256 vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
    expect(sha256Hex('McDonald’s 🍔')).toBe(
      '956eef4ac82e2e567927ec74e6def7dd2da226b0af6ca2725103d2876279ec6e'
    );
  });

  test('sorts object keys recursively without reordering arrays', () => {
    const left = { z: 1, a: { y: 2, x: [3, 1] } };
    const right = { a: { x: [3, 1], y: 2 }, z: 1 };
    expect(canonicalJson(left)).toBe('{"a":{"x":[3,1],"y":2},"z":1}');
    expect(canonicalHash(left)).toBe(canonicalHash(right));
    expect(canonicalHash({ values: [1, 2] })).not.toBe(canonicalHash({ values: [2, 1] }));
  });

  test('canonicalizes negative zero and rejects non-finite numbers', () => {
    expect(canonicalJson(-0)).toBe('0');
    expect(() => canonicalJson(Number.POSITIVE_INFINITY)).toThrow('non-finite');
    expect(() => canonicalJson(Number.NaN)).toThrow('non-finite');
  });
});
