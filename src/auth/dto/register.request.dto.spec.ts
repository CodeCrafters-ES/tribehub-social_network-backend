import { validateSync } from 'class-validator';
import { beforeAll, describe, expect, it } from 'vitest';
import { RegisterRequestDto } from './register.request.dto';

describe('Register request dto test suite', () => {
  let errors: ReturnType<typeof validateSync>;

  beforeAll(() => {
    const registerRequestDto = new RegisterRequestDto();
    registerRequestDto.email = 'example.mailexample.com';
    registerRequestDto.username = 'caballero de la noche';
    registerRequestDto.password = '0123456';
    errors = validateSync(registerRequestDto);
  });

  it('Email should return false if value is invalid', () => {
    const emailErrors = errors.filter((e) => e.property === 'email');
    expect(emailErrors.length).toBeGreaterThan(0);
  });

  it('Username should return false if value is invalid', () => {
    const usernameErrors = errors.filter((e) => e.property === 'username');
    expect(usernameErrors.length).toBeGreaterThan(0);
  });

  it('Password should return false if value is invalid', () => {
    const passwordErrors = errors.filter((e) => e.property === 'password');
    expect(passwordErrors.length).toBeGreaterThan(0);
  });
});
