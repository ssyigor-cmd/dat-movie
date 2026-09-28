import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAutoRotate } from '../src/lib/autoRotate.js';

describe('createAutoRotate', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('avança a cada intervalo', () => {
    const onTick = vi.fn();
    const r = createAutoRotate({ intervalMs: 15000, onTick });
    r.start();
    expect(onTick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(15000);
    expect(onTick).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(15000);
    expect(onTick).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(45000);
    expect(onTick).toHaveBeenCalledTimes(5);
  });

  it('para de avancar depois de stop()', () => {
    const onTick = vi.fn();
    const r = createAutoRotate({ intervalMs: 15000, onTick });
    r.start();
    vi.advanceTimersByTime(15000);
    expect(onTick).toHaveBeenCalledTimes(1);
    r.stop();
    vi.advanceTimersByTime(60000);
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('restart() zera a contagem (quem navega tem o intervalo inteiro)', () => {
    const onTick = vi.fn();
    const r = createAutoRotate({ intervalMs: 15000, onTick });
    r.start();
    vi.advanceTimersByTime(14000);
    // o usuário clicou na seta aqui
    r.restart();
    // 1s depois não pode ter tidado: a contagem voltou a zero
    vi.advanceTimersByTime(1000);
    expect(onTick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(14000);
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('start() é idempotente: nunca deixa dois timers vivos', () => {
    const onTick = vi.fn();
    const r = createAutoRotate({ intervalMs: 15000, onTick });
    r.start();
    r.start();
    r.start();
    vi.advanceTimersByTime(15000);
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('shouldRun=false congela sem desligar o timer', () => {
    const onTick = vi.fn();
    let paused = true;
    const r = createAutoRotate({ intervalMs: 15000, onTick, shouldRun: () => !paused });
    r.start();
    vi.advanceTimersByTime(60000);
    expect(onTick).not.toHaveBeenCalled();
    expect(r.isRunning()).toBe(true);
    paused = false;
    vi.advanceTimersByTime(15000);
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('isRunning reflete o estado real', () => {
    const r = createAutoRotate({ intervalMs: 1000, onTick: () => {} });
    expect(r.isRunning()).toBe(false);
    r.start();
    expect(r.isRunning()).toBe(true);
    r.stop();
    expect(r.isRunning()).toBe(false);
  });

  it('stop() em um rotor que nunca iniciou não estoura', () => {
    const r = createAutoRotate({ intervalMs: 1000, onTick: () => {} });
    expect(() => r.stop()).not.toThrow();
  });
});
