# Smoke Tests — TribeHub Backend

Suite mínima de smoke tests que se ejecuta contra un entorno real (staging o producción) para detectar roturas críticas tras un deploy.

## Estructura

```
test/smoke/
  smoke.config.ts        — helper compartido que lee env vars y valida credenciales
  staging.smoke.test.ts  — suite para staging (https://staging.tribehub.app)
  prod.smoke.test.ts     — suite para producción (https://tribehub.app)
```

## Tests incluidos

Los dos suites ejecutan los mismos 3 tests:

1. `GET /` — el backend responde (sonda de alcanzabilidad hasta que `HealthModule` esté implementado)
2. `POST /auth/login` — login con el usuario de smoke; verifica que Supabase Auth funciona y devuelve token
3. `POST /auth/logout` — logout con el token obtenido; verifica que el guard de autenticación funciona

## Ejecución local

### Staging

```bash
# 1. Configura las variables en tu .env (en la raíz del backend)
SMOKE_BASE_URL=http://localhost:3000   # o https://staging.tribehub.app si apuntas a staging real
SMOKE_USER_EMAIL=smoke@tribehub.app
SMOKE_USER_PASSWORD=tu-password

# 2. Arranca el backend (si apuntas a local)
pnpm run start:dev

# 3. Ejecuta la suite
pnpm test:smoke
```

### Producción

```bash
# 1. Configura las variables en tu .env
SMOKE_BASE_URL=https://tribehub.app
PROD_SMOKE_USER=smoke-prod@tribehub.app
PROD_SMOKE_PASS=tu-password-prod

# 2. Ejecuta la suite de producción
pnpm test:smoke:prod
```

> **Nunca uses las mismas credenciales para staging y producción.**

## Variables de entorno

| Variable | Suite | Descripción | Valor por defecto |
|---|---|---|---|
| `SMOKE_BASE_URL` | ambas | URL base del entorno a testear | staging: `https://staging.tribehub.app` / prod: `https://tribehub.app` |
| `SMOKE_USER_EMAIL` | staging | Email del usuario de smoke de staging | — (requerido) |
| `SMOKE_USER_PASSWORD` | staging | Contraseña del usuario de smoke de staging | — (requerido) |
| `PROD_SMOKE_USER` | prod | Email del usuario de smoke de producción | — (requerido) |
| `PROD_SMOKE_PASS` | prod | Contraseña del usuario de smoke de producción | — (requerido) |

## Configuración de secrets en GitHub

Los secrets se configuran por environment en **Settings → Secrets and variables → Actions → Environments**.

### Environment `staging`

| Secret | Valor |
|---|---|
| `SMOKE_BASE_URL` | `https://staging.tribehub.app` |
| `SMOKE_USER_EMAIL` | email del usuario de smoke de staging |
| `SMOKE_USER_PASSWORD` | contraseña del usuario de smoke de staging |

### Environment `production`

| Secret | Valor |
|---|---|
| `SMOKE_BASE_URL` | `https://tribehub.app` |
| `PROD_SMOKE_USER` | email del usuario de smoke de producción |
| `PROD_SMOKE_PASS` | contraseña del usuario de smoke de producción |

## Integración en CI/CD

| Workflow | Cuándo se ejecuta | Protección |
|---|---|---|
| `deploy-staging.yml` (job `smoke`) | Automáticamente tras cada deploy a staging (push a `develop`) | Ninguna — gate de calidad automático |
| `deploy-production.yml` (job `smoke`) | Automáticamente tras cada deploy a producción | Environment `production` (aprobación manual si está configurada) |
| `smoke-staging.yml` | Manual (`workflow_dispatch`) | Ninguna |
| `smoke-prod.yml` | Manual (`workflow_dispatch`) | Environment `production` |

## Crear el usuario de smoke

Los usuarios de smoke deben crearse manualmente en Supabase:

1. Ve a tu proyecto en [supabase.com](https://supabase.com) → **Authentication → Users**
2. Clic en **Add user → Create new user**
3. Introduce el email y contraseña del usuario de smoke
4. Confirma el email manualmente desde el dashboard si es necesario

Crea un usuario distinto para staging y otro para producción.
