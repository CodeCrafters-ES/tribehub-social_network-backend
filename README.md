# 🚀 Social Network WebApp - Backend API

## Bienvenido/a al repositorio del proyecto **Social Network** (TribeHub) - Backend API

Este proyecto es una API RESTful construida con **NestJS**, **TypeScript**, **Prisma** y **Supabase** que proporciona servicios de autenticación y gestión de usuarios para la aplicación de red social.

---

[![Licencia](https://img.shields.io/badge/licencia-MIT-blue)](LICENSE)
[![NestJS](https://img.shields.io/badge/nestjs-E0234E?style=flat&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/typescript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)](https://supabase.com/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![pnpm](https://img.shields.io/badge/pnpm-F69220?style=flat&logo=pnpm&logoColor=white)](https://pnpm.io/)

---

## 🔹 **Funcionalidades clave**

- 🔐 **Autenticación robusta** con Supabase (registro, login, JWT)
- 👤 **Gestión de usuarios** con perfiles y datos seguros
- 🛡️ **Guards y middleware** para protección de rutas
- 🔒 **Validación de datos** con class-validator
- 📝 **DTOs tipados** para requests y responses
- 🧪 **Testing completo** con Vitest y Supertest

---

## 🏗️ **Arquitectura**

```mermaid
graph TB
    A[Cliente] --> B[API Gateway]
    B --> C[NestJS App]
    C --> D[Auth Module]
    C --> E[User Module]
    C --> F[Posts Module]
    D --> G[Supabase Auth / Prisma]
    G --> H[(Base de Datos)]
    E --> H
    F --> H
```

### Flujo de Autenticación

```mermaid
sequenceDiagram
    participant C as Cliente
    participant A as AuthController
    participant S as AuthService
    participant U as Database / Supabase

    C->>A: POST /auth/register
    A->>S: register(userData)
    S->>U: createUser(email, password)
    U-->>S: userRecord
    S-->>A: success response
    A-->>C: 201 Created
```

---

## 🏗️ **Infraestructura (Docker)**

Para desarrollo local y persistencia, utilizamos Docker para los servicios de base de datos y cache.

### **Base de Datos (PostgreSQL)**
Levantar el contenedor en el puerto **5433** para evitar conflictos:
```bash
docker run -d --name db-tribehub \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=postgres \
  -p 5433:5432 \
  postgres:15-alpine
```

### **Redis**
```bash
docker run -d --name redis-tribehub -p 6379:6379 redis:alpine
```

---

## 🖥️ **Configuración y Uso**

### **Requisitos Previos**

- Node.js >= 20.x
- **pnpm** >= 9.x
- Docker Desktop
- Una cuenta de Supabase con proyecto configurado

### **Instalación**

1. **Clona el repositorio**:
```bash
git clone https://github.com/CodeCrafters-ES/social-network-webapp-backend.git
cd social-network-webapp-backend
```

2. **Instala dependencias**:
> [!IMPORTANT]
> El proyecto requiere **pnpm**. No utilices `npm` ni `yarn` para evitar conflictos de versiones en `node_modules`.
```bash
pnpm install
```

3. **Configura las variables de entorno**:
Crea un archivo `.env` en la raíz del proyecto:
```env
# Database Configuration (Docker local porto 5433)
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/postgres?schema=public"
REDIS_URL="redis://localhost:6379"

# Supabase Configuration
SUPABASE_URL=tu_supabase_url
SUPABASE_ANON_KEY=tu_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# JWT Configuration
JWT_SECRET=tu_jwt_secret

# Application
PORT=3000
NODE_ENV=development
```

4. **Base de Datos (Prisma)**:
```bash
pnpm prisma db push
pnpm prisma generate
```

5. **Inicia el servidor**:
```bash
pnpm run start:dev
```

---

## 🧪 **Testing**

```bash
# Ejecutar todos los tests
pnpm run test

# Testing con coverage
pnpm run test:cov
```

---

## 📁 **Estructura del Proyecto**

```
social-network-webapp-backend/
├── src/
│   ├── auth/                 # Módulo de autenticación
│   │   ├── dto/             # Data Transfer Objects
│   │   ├── guards/          # Guards para protección de rutas
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.module.ts
│   ├── config/              # Configuración de servicios externos
│   │   └── supabase.config.ts
│   ├── common/              # Utilidades compartidas y Middleware
│   ├── prisma/              # Prisma Service y Database
│   ├── modules/             # Módulos de la aplicación
│   │   ├── users/           # Gestión de usuarios
│   │   ├── posts/           # Publicaciones
│   │   └── notifications/   # Notificaciones
│   ├── app.controller.ts
│   ├── app.module.ts
│   └── main.ts             # Punto de entrada
├── test/                   # Tests end-to-end
├── .env                    # Variables de entorno
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🚀 **Scripts Disponibles**

| Script | Descripción |
|--------|-------------|
| `pnpm run start:dev` | Servidor de desarrollo con watch mode |
| `pnpm run build` | Compilar la aplicación |
| `pnpm run test` | Ejecutar tests unitarios |
| `pnpm prisma studio` | Panel visual para la base de datos |

---

## 🔧 **Tecnologías Utilizadas**

- **Framework**: NestJS
- **Lenguaje**: TypeScript
- **Base de datos**: PostgreSQL (Prisma) / Supabase
- **Cache**: Redis
- **Autenticación**: Supabase Auth + JWT
- **Validación**: class-validator + class-transformer
- **Testing**: Vitest + Supertest

---

## 🛠️ **Troubleshooting**

### **Error de tipos de 'pg' (TypeScript)**
Si TypeScript reporta errores en `PrismaService` relacionados con el driver `pg`, es probable que haya contaminación en `node_modules`.
**Solución**:
```bash
rm -r node_modules; rm pnpm-lock.yaml; pnpm install
```

### **Error P1001 (Base de datos no encontrada)**
Asegúrate de que el contenedor de Docker esté corriendo: `docker start db-tribehub`.

---

## 📜 **Licencia**

Este proyecto es de código abierto bajo licencia [MIT](LICENSE).

© 2026 CodeCrafters - ES

---

## 🔄 **Estado del Proyecto**

🏗️ **En Desarrollo Activo** - Implementando módulo de Autenticación y limpieza de arquitectura.
b-tribehub`.

---

## 📜 **Licencia**

Este proyecto es de código abierto bajo licencia [MIT](LICENSE).

© 2026 CodeCrafters - ES

---

## 🔄 **Estado del Proyecto**

🏗️ **En Desarrollo Activo** - Implementando módulo de Autenticación y limpieza de arquitectura.
# TribeHub — Backend API

API RESTful para la red social comunitaria TribeHub, construida con **NestJS** y **TypeScript**.

[![Licencia](https://img.shields.io/badge/licencia-MIT-blue)](LICENSE)
[![NestJS](https://img.shields.io/badge/nestjs-E0234E?style=flat&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/typescript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | NestJS |
| Lenguaje | TypeScript |
| Base de datos | PostgreSQL (Prisma ORM) |
| Autenticación | Supabase Auth + JWT |
| Cola de trabajos | BullMQ + Redis |
| Métricas | Prometheus (prom-client) |
| Error tracking | Sentry |
| Validación | class-validator + class-transformer |
| Tests | Vitest |
| Deploy | Railway |

---

## Módulos implementados

| Módulo | Descripción |
|---|---|
| `AuthModule` | Registro y login via Supabase Auth |
| `HealthModule` | `GET /api/v1/health` — liveness check |
| `ObservabilityModule` | Métricas Prometheus, requestId middleware, LoggingInterceptor, Sentry |
| `SystemConfigModule` | Feature flags en base de datos con caché Redis |
| `QueuesModule` | Colas BullMQ con reintentos, worker y alertas a Discord |
| `BullboardModule` | Panel de administración de colas en `/admin/queues` |

---

## Requisitos previos

- Node.js >= 18.x
- pnpm >= 8.x
- Redis (local via Docker o Railway en cloud)
- Cuenta de Supabase con proyecto configurado

---

## Instalación

```bash
git clone https://github.com/CodeCrafters-ES/tribehub-social_network-backend.git
cd tribehub-social_network-backend
pnpm install
```

Copia el archivo de entorno:

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales (ver sección Variables de entorno).

---

## Arrancar en desarrollo

```bash
# Redis local (requiere Docker)
docker run -d --name redis-tribehub -p 6379:6379 redis:alpine

# Servidor con auto-reload
pnpm run start:dev
```

La API estará disponible en `http://localhost:3000/api/v1`.

---

## Variables de entorno

| Variable | Descripción | Requerida |
|---|---|---|
| `PORT` | Puerto del servidor (default: 3000) | No |
| `NODE_ENV` | `development` / `staging` / `production` | Sí |
| `CORS_ORIGINS` | Orígenes CORS permitidos (separados por coma) | Sí |
| `SUPABASE_URL` | URL del proyecto Supabase | Sí |
| `SUPABASE_ANON_KEY` | Clave anon de Supabase | Sí |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave service role de Supabase | Sí |
| `SUPABASE_JWT_SECRET` | JWT secret de Supabase (para validar tokens) | Sí |
| `JWT_SECRET` | Secreto JWT interno | Sí |
| `DATABASE_URL` | URL de conexión PostgreSQL | Sí |
| `REDIS_URL` | URL de conexión Redis | Sí |
| `REDIS_TLS` | `true` para habilitar TLS (Railway/producción) | No |
| `FRONTEND_URL` | URL del frontend (redirecciones y CORS) | Sí |
| `SENTRY_DSN` | DSN de Sentry (si no se define, Sentry se deshabilita) | No |
| `METRICS_USER` | Usuario Basic Auth para endpoint de métricas | Sí |
| `METRICS_PASS` | Contraseña Basic Auth para endpoint de métricas | Sí |
| `METRICS_PATH_SECRET` | Segmento secreto del path de métricas | Sí |
| `DISCORD_WEBHOOK_CRITICAL` | Webhook Discord canal `#alerts-critical` | No |
| `DISCORD_WEBHOOK_OPS` | Webhook Discord canal `#alerts-ops` | No |
| `QUEUE_ALERT_WAITING_THRESHOLD` | Umbral jobs en espera para alerta (default: 50) | No |
| `QUEUE_ALERT_FAILED_THRESHOLD` | Umbral jobs fallidos para alerta (default: 20) | No |
| `QUEUE_MONITOR_INTERVAL_MS` | Intervalo de polling de métricas de cola (default: 60000) | No |
| `SMOKE_BASE_URL` | URL base para smoke tests | No |
| `SMOKE_USER_EMAIL` | Email del usuario de smoke tests | No |
| `SMOKE_USER_PASSWORD` | Contraseña del usuario de smoke tests | No |

---

## Scripts disponibles

```bash
pnpm run start:dev      # Servidor de desarrollo con auto-reload
pnpm run start:debug    # Modo debug con auto-reload
pnpm run build          # Compilar a dist/
pnpm run start:prod     # Ejecutar build compilado

pnpm run test           # Tests unitarios
pnpm run test:watch     # Tests en modo watch
pnpm run test:cov       # Tests con reporte de cobertura
pnpm run test:e2e       # Tests end-to-end
pnpm run test:smoke     # Smoke tests

pnpm run lint           # ESLint con auto-fix
pnpm run format         # Prettier
pnpm run lint:api       # Validar OpenAPI spec con Spectral
```

---

## Endpoints principales

| Método | Endpoint | Descripción | Auth |
|---|---|---|---|
| GET | `/api/v1/health` | Liveness check | No |
| POST | `/api/v1/auth/register` | Registro de usuario | No |
| POST | `/api/v1/auth/login` | Login | No |
| POST | `/api/v1/auth/logout` | Logout | Bearer |
| GET | `/admin/queues` | Panel BullBoard | Bearer + rol admin |

---

## Estructura del proyecto

```
src/
  auth/                   # Módulo de autenticación (Supabase)
    dto/
    guards/
    repositories/
  common/                 # Utilidades compartidas
    filters/              # SentryExceptionFilter
    guards/               # JwtAdminGuard
    interceptors/         # LoggingInterceptor, HttpMetricsInterceptor
    middleware/           # RequestIdMiddleware, MetricsAuthMiddleware
  config/                 # supabase.config.ts
  health/                 # HealthModule — GET /health
  modules/
    system-config/        # Feature flags con caché Redis
    users/                # UsersModule (scaffold)
  observability/
    metrics/              # MetricsService, MetricsController
  prisma/                 # PrismaService
  admin/
    queues/               # BullboardModule
  queues/                 # QueuesModule, DefaultWorker
    alerts/               # DiscordAlertService, QueueMonitorService
  instrument.ts           # Inicialización de Sentry
  main.ts
test/
  smoke/                  # Smoke tests staging y producción
docs/
  openapi/openapi.yaml    # Spec OpenAPI (validado con Spectral en CI)
  observability.md        # Guía de métricas y requestId
```

---

## Documentación adicional

- [Observabilidad](docs/observability.md) — métricas, requestId, BullBoard
- [OpenAPI spec](docs/openapi/openapi.yaml) — contrato de la API
- [Guía de contribución](CONTRIBUTING.md)
- [NestJS docs](https://docs.nestjs.com/)

---

## Licencia

MIT © 2025 CodeCrafters-ES
