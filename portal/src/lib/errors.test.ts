import { describe, expect, it } from 'vitest';
import { errorMessage } from './errors';

describe('mensajes de error', () => {
  it('no expone detalles técnicos', () => {
    expect(errorMessage({ code: '42P01', message: 'relation "x" does not exist' })).toBe('Ocurrió un error. Intentá de nuevo.');
    expect(errorMessage({ code: '42501', message: 'permission denied for table employments' })).toBe('No tenés permiso para realizar esta acción.');
  });
  it('conserva mensajes de negocio del servidor', () => {
    expect(errorMessage({ code: '22023', message: 'El PIN debe tener 6 dígitos' })).toBe('El PIN debe tener 6 dígitos');
  });
  it('credenciales inválidas', () => expect(errorMessage({ message: 'Invalid login credentials' })).toBe('Correo o contraseña incorrectos.'));
});
