import { describe, expect, it } from 'vitest';
import { redact, redactValue } from './redact';

describe('redact', () => {
  it.each([
    ['Authorization: Bearer sk-ant-oat01-abcdefghijklmnop', 'Authorization: [redacted]'],
    ['key sk-ant-oat01-abcdefghijklmnop end', 'key [redacted] end'],
    ['jwt eyJhbGciOi.eyJzdWIiOiIx.c2lnbmF0dXJl here', 'jwt [redacted] here'],
    ['{"accessToken":"abc123","x":1}', '{"accessToken":"[redacted]","x":1}'],
    ['refresh_token=xyz789&a=b', 'refresh_token=[redacted]&a=b'],
  ])('%s', (input, expected) => {
    expect(redact(input)).toBe(expected);
  });

  it('leaves ordinary text alone', () => {
    expect(redact('Claude 5-hour limit at 82%')).toBe('Claude 5-hour limit at 82%');
  });
});

describe('redactValue', () => {
  it('redacts strings, errors and nested objects', () => {
    expect(redactValue('Bearer abc.def')).toBe('[redacted]');
    expect((redactValue(new Error('failed with Bearer abc')) as Error).message).toBe('failed with [redacted]');
    expect(redactValue({ headers: { Authorization: 'Bearer abc' }, accessToken: 'zzz' })).toEqual({
      headers: { Authorization: '[redacted]' },
      accessToken: '[redacted]',
    });
    expect(redactValue(42)).toBe(42);
  });
});
