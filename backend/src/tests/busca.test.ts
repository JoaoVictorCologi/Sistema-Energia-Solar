import { describe, expect, it } from 'vitest';
import { comoTrechoDoLike } from '../utils/busca.ts';

describe('comoTrechoDoLike', () => {
  it('procura o trecho em qualquer parte do texto', () => {
    expect(comoTrechoDoLike('moco')).toBe('%moco%');
  });

  it('% e _ digitados valem como texto, não como curinga', () => {
    expect(comoTrechoDoLike('50%_a')).toBe('%50\\%\\_a%');
    expect(comoTrechoDoLike('a\\b')).toBe('%a\\\\b%');
  });
});
