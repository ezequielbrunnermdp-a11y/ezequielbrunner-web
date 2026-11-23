import { describe, expect, it, vi } from 'vitest';
import { enqueue, flushQueue, readQueue } from './offlineQueue';

const p = (id: string) => ({ clientRequestId: id, kind: 'in' as const, branchId: 'b', branchName: 'Güemes', declaredAt: '2026-11-23T12:00:00Z' });
describe('cola de fichadas sin conexión', () => {
  it('no duplica un mismo pedido', () => {
    enqueue(p('1')); enqueue(p('1'));
    expect(readQueue()).toHaveLength(1);
  });
  it('envía y vacía la cola; se detiene ante un error para reintentar luego', async () => {
    enqueue(p('1')); enqueue(p('2')); enqueue(p('3'));
    const send = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('offline'));
    expect(await flushQueue(send)).toBe(1);
    expect(readQueue().map((x) => x.clientRequestId)).toEqual(['2', '3']);
  });
});
