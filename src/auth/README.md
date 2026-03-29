# Módulo de Autenticación (Supabase)

Este módulo provee endpoints para registro y login de usuarios usando Supabase como backend de autenticación.

## Configuración

Asegúrate de tener las siguientes variables en tu archivo `.env` en la raíz del proyecto:

```
SUPABASE_URL=tu-url-de-supabase
SUPABASE_ANON_KEY=tu-anon-key-de-supabase
```

## Endpoints

### Registro de usuario

**POST** `/api/v1/auth/register`

```json
{
  "email": "usuario@dominio.com",
  "username": "nombreusuario",
  "password": "passwordseguro"
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "data": { "user": { ... } },
  "message": "User registered successfully"
}
```

**Nota:** El usuario debe confirmar el email antes de poder iniciar sesión.

---

### Login de usuario

**POST** `/api/v1/auth/login`

```json
{
  "email": "usuario@dominio.com",
  "password": "passwordseguro"
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "data": { "session": { ... } },
  "message": "Login successful"
}
```

**Error si el email no está confirmado:**
```json
{
  "success": false,
  "error": {
    "code": "LOGIN_ERROR",
    "message": "Email not confirmed"
  }
}
```

---

## Guía de integración frontend

1. **Registro:**  
   Envía los datos al endpoint `/api/v1/auth/register`.  
   Muestra mensaje de confirmación y solicita al usuario verificar su email.

2. **Confirmación de email:**  
   El usuario debe hacer clic en el enlace enviado por Supabase.

3. **Login:**  
   Envía email y password a `/api/v1/auth/login`.  
   Si el email está confirmado, recibirás el token JWT en `data.session.access_token`.

4. **Uso del token:**  
   Guarda el token JWT en localStorage o en memoria.  
   Inclúyelo en el header `Authorization: Bearer <token>` para acceder a rutas protegidas.

**Ejemplo con fetch:**
```js
// Registro
fetch('/api/v1/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, username, password })
});

// Login
const res = await fetch('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
const { data } = await res.json();
const token = data.session.access_token;
```

---

## Errores comunes

- **Email inválido o ya registrado:** Verifica el formato y que no exista en Supabase.
- **Email no confirmado:** Solicita al usuario revisar su correo y confirmar.
- **Contraseña débil:** Usa mínimo 6 caracteres.

---

## Flujo recomendado

```
Frontend -> /api/v1/auth/register -> Confirmar Email -> /api/v1/auth/login -> /api/v1/auth/refresh -> /api/v1/auth/logout

```

---

## Pruebas y comandos

Para ejecutar los tests del módulo de autenticación:

- Ejecutar todos los tests:
  ```bash
  npm run test
  ```

- Ejecutar en modo watch:
  ```bash
  npm run test:watch
  ```

- Ejecutar con cobertura:
  ```bash
  npm run test:cov
  ```

- Ejecutar solo los tests de auth:
  ```bash
  npm run test -- auth
  ```

- Ejecutar tests e2e:
  ```bash
  npm run test:e2e
  ```

Los resultados aparecerán en la terminal indicando si las pruebas pasaron o fallaron.
### Refresh de sesión

**POST** `/api/v1/auth/refresh`

Puede recibir el refresh token vía:
- `body.refreshToken`
- header `x-refresh-token`
- header `Authorization: Bearer <refreshToken>`
- cookie `refreshToken`

Si el token está en blacklist de Redis, responde `401`.

---

### Logout (idempotente)

**POST** `/api/v1/auth/logout`

Revoca el refresh token en Redis blacklist usando `jti` (si existe) o hash SHA-256 del token como fallback.

El endpoint es idempotente: repetir logout no rompe el flujo.

---
