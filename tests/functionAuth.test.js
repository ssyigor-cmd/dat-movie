import { describe, it, expect } from 'vitest';
// Importa o MESMO módulo usado pelas Edge Functions.
import { readClaims, isAuthenticatedUser, unauthorizedResponse } from '../supabase/functions/_shared/auth.ts';

const b64 = (obj) =>
  Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Monta um token no formato header.payload.signature (o módulo exige 3). */
const token = (claims) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.assinatura`;

const makeReq = (claims) =>
  new Request('https://exemplo.test/fn', {
    method: 'POST',
    headers: claims ? { Authorization: `Bearer ${token(claims)}` } : {},
  });

const CORS = { 'Access-Control-Allow-Origin': '*' };

describe('readClaims', () => {
  it('lê claims de um token bem formado', () => {
    const req = makeReq({ role: 'authenticated', sub: 'uuid-123' });
    expect(readClaims(req)).toEqual({ role: 'authenticated', sub: 'uuid-123' });
  });

  it('retorna null sem header Authorization', () => {
    expect(readClaims(makeReq(null))).toBeNull();
  });

  it('retorna null para esquema diferente de Bearer', () => {
    const req = new Request('https://exemplo.test/fn', { headers: { Authorization: 'Basic abc.def.ghi' } });
    expect(readClaims(req)).toBeNull();
  });

  it('retorna null para token sem 3 segmentos', () => {
    const req = new Request('https://exemplo.test/fn', { headers: { Authorization: 'Bearer so.parte' } });
    expect(readClaims(req)).toBeNull();
  });

  it('retorna null para payload que não é JSON', () => {
    const req = new Request('https://exemplo.test/fn', {
      headers: { Authorization: `Bearer ${b64({})}.${btoa('nao-e-json')}.c` },
    });
    expect(readClaims(req)).toBeNull();
  });
});

describe('isAuthenticatedUser', () => {
  it('aceita usuário autenticado com sub', () => {
    expect(isAuthenticatedUser({ role: 'authenticated', sub: 'uuid-123' })).toBe(true);
  });

  // Regressão: a anon key é um JWT válido e PÚBLICO (fica no bundle do
  // navegador). verify_jwt=true accepta ela, então só checar assinatura
  // deixava a cota da API de terceiros aberta para qualquer pessoa.
  it('REJEITA a anon key (role anon, sem sub)', () => {
    expect(isAuthenticatedUser({ role: 'anon', ref: 'abc' })).toBe(false);
  });
  it('rejeita role anon mesmo que venha com sub', () => {
    expect(isAuthenticatedUser({ role: 'anon', sub: 'uuid-123' })).toBe(false);
  });
  it('rejeita authenticated sem sub', () => {
    expect(isAuthenticatedUser({ role: 'authenticated' })).toBe(false);
  });
  it('rejeita sub vazio', () => {
    expect(isAuthenticatedUser({ role: 'authenticated', sub: '' })).toBe(false);
  });
  it('rejeita sub que não é string', () => {
    expect(isAuthenticatedUser({ role: 'authenticated', sub: 42 })).toBe(false);
  });
  it('rejeita null', () => {
    expect(isAuthenticatedUser(null)).toBe(false);
  });
  it('rejeita service_role (não é usuário final)', () => {
    expect(isAuthenticatedUser({ role: 'service_role', sub: 'uuid' })).toBe(false);
  });
});

describe('unauthorizedResponse', () => {
  it('responde 401 com JSON e preserva os CORS', () => {
    const res = unauthorizedResponse(CORS);
    expect(res.status).toBe(401);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
