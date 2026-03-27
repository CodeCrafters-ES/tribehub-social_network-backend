import { beforeAll, describe, expect, it } from 'vitest';
import { RegisterRequestDto } from './register.request.dto';


describe('Register request dto test suite', () => {
  const registerRequestDto = new RegisterRequestDto();

  beforeAll(() => {
    registerRequestDto.email = 'example.mailexample.com';
    registerRequestDto.username = 'caballero de la noche';
    registerRequestDto.password = '0123456';
  });

  it('Email should return false if value is invalid', () => {
    expect(registerRequestDto.email).toBeFalsy();
  });

  it('Username should return false if value is invalid', () => {
    expect(registerRequestDto.username).toBeFalsy();
  });

  it('Password should return false if value is invalid', () => {
    expect(registerRequestDto.password).toBeFalsy();
  });
});
