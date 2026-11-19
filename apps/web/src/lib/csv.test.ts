import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';

describe('parseCsv', () => {
  it('handles quotes, commas and newlines inside fields, BOM and CRLF', () => {
    expect(parseCsv('﻿name,cat\r\n"پرس، سینه",chest\n"a ""b""",legs\n\n')).toEqual([
      ['name', 'cat'],
      ['پرس، سینه', 'chest'],
      ['a "b"', 'legs'],
    ]);
  });
});
