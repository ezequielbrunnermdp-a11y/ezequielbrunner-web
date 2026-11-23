import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ClockStatus, PunchResult } from '@/lib/types';

// La interfaz NUNCA decide: se simula el servidor para comprobar que solo se
// muestra "registrado" cuando clock_punch responde confirmed.
const rpc = vi.fn();
vi.mock('@/lib/supabase', () => ({ rpc: (...a: unknown[]) => rpc(...a), supabase: {} }));
vi.mock('@/lib/geo', () => ({ getBestFix: vi.fn().mockResolvedValue({ lat: -38.0055, lng: -57.5426, accuracy: 12, at: 0 }) }));

import { ClockPage } from './ClockPage';

const BRANCH = '3f2b8c1e-1d2a-4c3b-9e8f-0a1b2c3d4e5f';
const status: ClockStatus = {
  server_time: new Date().toISOString(), open_session: null, next_shift: null,
  branches: [{ id: BRANCH, name: 'Güemes', require_qr: true, require_gps: true, radius_m: 40, has_coordinates: true }],
};

function setup(punch: PunchResult | Error) {
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'my_clock_status') return status;
    if (fn === 'clock_punch') { if (punch instanceof Error) throw punch; return punch; }
    return null;
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/fichaje?b=${BRANCH}&t=TOKEN_VALIDO_1234567890`]}>
        <Routes><Route path="/fichaje" element={<ClockPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Fichaje móvil', () => {
  beforeEach(() => rpc.mockReset());

  it('muestra confirmación solo cuando el servidor confirma, con su hora', async () => {
    setup({ result: 'confirmed', status: 'confirmed', kind: 'in', server_time: '2026-11-23T12:03:00Z', branch_name: 'Güemes', flags: [] });
    await userEvent.click(await screen.findByRole('button', { name: /registrar ingreso/i }));
    expect(await screen.findByText(/ingreso registrado/i)).toBeInTheDocument();
    expect(screen.getByText('09:03')).toBeInTheDocument();
    const call = rpc.mock.calls.find((c) => c[0] === 'clock_punch')![1] as Record<string, unknown>;
    expect(call.p_qr_token).toBe('TOKEN_VALIDO_1234567890');
    expect(call.p_client_request_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(call.p_lat).toBe(-38.0055);
  });

  it('fuera del perímetro: informa que NO se registró y ofrece revisión', async () => {
    setup({ result: 'geo_outside', distance_m: 950, radius_m: 40, accuracy_m: 12, review_available: true });
    await userEvent.click(await screen.findByRole('button', { name: /registrar ingreso/i }));
    expect(await screen.findByText(/fuera del perímetro/i)).toBeInTheDocument();
    expect(screen.getByText(/no fue registrada/i)).toBeInTheDocument();
    expect(screen.queryByText(/ingreso registrado/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar para revisión/i })).toBeInTheDocument();
  });

  it('pedido de revisión: queda pendiente, nunca como confirmado', async () => {
    setup({ result: 'geo_outside', review_available: true });
    await userEvent.click(await screen.findByRole('button', { name: /registrar ingreso/i }));
    rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'clock_punch') { expect(args.p_request_review).toBe(true); return { result: 'pending_review', status: 'pending_review', kind: 'in', server_time: '2026-11-23T12:05:00Z' }; }
      return status;
    });
    await userEvent.click(await screen.findByRole('button', { name: /enviar para revisión/i }));
    expect(await screen.findByText(/pendiente de revisión/i)).toBeInTheDocument();
    expect(screen.getByText(/todavía no está confirmada/i)).toBeInTheDocument();
  });

  it('QR vencido: pide escanear de nuevo', async () => {
    setup({ result: 'qr_expired' });
    await userEvent.click(await screen.findByRole('button', { name: /registrar ingreso/i }));
    expect(await screen.findByText(/el código qr venció/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /escanear de nuevo/i })).toBeInTheDocument();
  });

  it('falla del servidor: avisa que la fichada NO se registró y permite guardarla como pendiente', async () => {
    setup(Object.assign(new Error('Failed to fetch'), {}));
    await userEvent.click(await screen.findByRole('button', { name: /registrar ingreso/i }));
    expect(await screen.findByText(/la fichada no se registró/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /guardar como pendiente/i }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem('pending-punches-v1') || '[]')).toHaveLength(1));
  });
});
