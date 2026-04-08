# Guía de contribución — TribeHub Backend API

---

## Requisitos previos

- Node.js >= 20.x
- pnpm >= 9.x
- Git
- Docker (para PostgreSQL y Redis locales)
- Cuenta de Supabase (plan gratuito es suficiente)

---

## Configuración del entorno local

### 1. Clonar y instalar dependencias

```bash
git clone https://github.com/CodeCrafters-ES/tribehub-social_network-backend.git
cd tribehub-social_network-backend
pnpm install
```

### 2. Crear proyecto Supabase propio

Cada colaborador usa su propio proyecto Supabase — nunca se comparten las credenciales de staging o producción.

1. Crea una cuenta gratuita en [supabase.com](https://supabase.com) si no tienes una.
2. Crea un nuevo proyecto (el plan gratuito es suficiente).
3. Ve a **Settings → API** y copia los valores de:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` → `SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY`
4. Ve a **Settings → JWT Settings** y copia el valor de `JWT Secret` → `SUPABASE_JWT_SECRET`.

### 3. Variables de entorno

```bash
cp -i .env.example .env.development
```

Edita `.env.development` con tus credenciales. Variables mínimas para desarrollo:

```env
PORT=3000
NODE_ENV=development
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
SUPABASE_JWT_SECRET=tu-jwt-secret
JWT_SECRET=cualquier-string-aleatorio-32-chars  # genera con: openssl rand -hex 32
DATABASE_URL=postgresql://tribehub:tribehub@localhost:5432/tribehub_dev
REDIS_URL=redis://localhost:6379
FRONTEND_URL=http://localhost:5173
METRICS_USER=metrics_user
METRICS_PASS=metrics_pass_changeme
METRICS_PATH_SECRET=_internal_metrics_local
```

### 4. Levantar dependencias locales con Docker

```bash
# PostgreSQL
docker run -d --name tribehub-db \
  -e POSTGRES_USER=tribehub \
  -e POSTGRES_PASSWORD=tribehub \
  -e POSTGRES_DB=tribehub_dev \
  -p 5432:5432 \
  postgres:16-alpine

# Redis
docker run -d --name tribehub-redis -p 6379:6379 redis:alpine
```

Estos valores coinciden con el `DATABASE_URL` del paso anterior. Solo necesitas ejecutarlos una vez; Docker los reinicia automáticamente al arrancar el sistema.

### 5. Aplicar migraciones de base de datos

```bash
npx prisma migrate dev
```

Sin este paso la app arranca pero todas las queries a la base de datos fallan.

### 6. Arrancar el servidor

```bash
pnpm run start:dev
```

La API estará disponible en `http://localhost:3000/api/v1`.

---

## Flujo de trabajo Git

### Ramas

Siempre rama desde `develop`. Nunca desde `main`.

| Tipo | Prefijo | Ejemplo |
|---|---|---|
| Feature | `feat/*` | `feat/p01-01-registro-usuario` |
| Bug fix | `fix/*` | `fix/feed-ordering-bug` |
| Sub-tarea colaborativa | `task/*` | `task/p01-01-auth-service` |
| Documentación | `docs/*` | `docs/update-openapi` |

### Convenciones de commit

Formato: `<tipo>: descripción breve en presente`

```bash
feat: (#45) implement user profile endpoint
fix: correct email validation in login
refactor: extract redis connection helper
docs: update observability guide
test: add unit tests for queue monitor
chore: update pnpm lockfile
```

Referencia el número de issue cuando aplique: `feat: (#45) ...`

### Sincronizar con develop antes de trabajar

```bash
git checkout develop
git pull origin develop
git checkout -b feat/mi-feature
```

---

## Pull Requests

- Apuntar siempre a `develop` (nunca a `main`)
- Incluir `Closes #ID` en la descripción para auto-cerrar el issue
- PRs deben ser pequeños y revisables
- Mínimo 1 aprobación requerida
- CI debe pasar (lint + tests + build + Spectral) antes del merge

### Checklist antes de abrir PR

```bash
pnpm run build       # debe compilar sin errores
pnpm run test        # todos los tests deben pasar
pnpm run lint        # sin errores de lint
pnpm run lint:api    # spec OpenAPI válido
```

---

## Desarrollo

### Arquitectura por capas

```
Controller → Service → Repository → DTOs
```

- **Controller**: HTTP, validación superficial, guards, mapeo de DTOs
- **Service**: lógica de negocio
- **Repository**: queries Prisma (uno por módulo, sin acceso cruzado)
- **DTOs**: validación con `class-validator`

Nuevo módulo en `src/modules/<dominio>/` con subcarpetas `controllers/`, `services/`, `dto/`, `repositories/`.

### Testing

Tests unitarios co-localizados con sufijo `.spec.ts`. Framework: Vitest.

```bash
pnpm run test              # todos los tests
pnpm run test -- <nombre>  # filtrar por nombre de archivo
pnpm run test:watch        # modo watch
pnpm run test:cov          # con cobertura
pnpm run test:smoke        # smoke tests (requiere servidor levantado)
```

### API Contract

El spec OpenAPI vive en `docs/openapi/openapi.yaml`. Spectral lo valida en CI y bloquea el merge si hay errores.

```bash
pnpm run lint:api   # validar spec localmente
```

Actualiza el spec en el mismo PR que el código del endpoint, nunca en un PR separado.

El endpoint de métricas (`/api/v1/_internal/...`) no se documenta en el spec público — ver `docs/observability.md`.

### Prisma

```bash
npx prisma migrate dev      # crear y aplicar migración en desarrollo
npx prisma generate         # regenerar Prisma Client
npx prisma studio           # GUI de datos
```

---

## Scripts disponibles

| Script | Descripción |
|---|---|
| `pnpm run start:dev` | Servidor de desarrollo con auto-reload |
| `pnpm run start:debug` | Modo debug con auto-reload |
| `pnpm run build` | Compilar a `dist/` |
| `pnpm run start:prod` | Ejecutar build compilado |
| `pnpm run test` | Tests unitarios |
| `pnpm run test:watch` | Tests en modo watch |
| `pnpm run test:cov` | Tests con cobertura |
| `pnpm run test:e2e` | Tests end-to-end |
| `pnpm run test:smoke` | Smoke tests |
| `pnpm run lint` | ESLint con auto-fix |
| `pnpm run format` | Prettier |
| `pnpm run lint:api` | Validar OpenAPI con Spectral |

---

## Seguridad

- Nunca commitear credenciales reales
- Usar variables de entorno para toda configuración sensible
- Validar inputs en todos los endpoints con DTOs y `class-validator`
- No saltarse hooks de pre-commit (`--no-verify`)

---

## Estado del proyecto

**Hito 1 — MVP Crítico** (en progreso)

Módulos implementados: `AuthModule`, `HealthModule`, `ObservabilityModule`, `SystemConfigModule`, `QueuesModule`, `BullboardModule`.

Módulos pendientes: `UsersModule`, `ProfilesModule`, `PostsModule`, `FeedModule`, `CommentsModule`, `ReactionsModule`, `SearchModule`, `AssetsModule`, `InterestsModule`.

---

## Documentación adicional

- [README](README.md)
- [Observabilidad](docs/observability.md)
- [OpenAPI spec](docs/openapi/openapi.yaml)
