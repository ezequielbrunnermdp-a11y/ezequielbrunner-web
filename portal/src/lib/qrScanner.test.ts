import { describe, expect, it } from 'vitest';
import { parseQrPayload } from './qrScanner';

const B = '3f2b8c1e-1d2a-4c3b-9e8f-0a1b2c3d4e5f';
describe('lectura del QR dinámico', () => {
  it('acepta el enlace generado por la pantalla de la sucursal', () => {
    expect(parseQrPayload(`https://equipo.example.com/fichaje?b=${B}&t=AbCdEfGhIjKlMnOpQrSt-_12`)).toEqual({ branchId: B, token: 'AbCdEfGhIjKlMnOpQrSt-_12' });
  });
  it('acepta el formato compacto', () => {
    expect(parseQrPayload(`EQ1:${B}:AbCdEfGhIjKlMnOpQrSt`)).toEqual({ branchId: B, token: 'AbCdEfGhIjKlMnOpQrSt' });
  });
  it('rechaza códigos ajenos', () => {
    expect(parseQrPayload('https://otro-sitio.com/?x=1')).toBeNull();
    expect(parseQrPayload('hola')).toBeNull();
    expect(parseQrPayload(`EQ1:no-uuid:token`)).toBeNull();
  });
});
