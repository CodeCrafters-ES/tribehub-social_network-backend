# 🤝 Guía de Contribución - Backend API

### ¡Gracias por tu interés en contribuir a este proyecto! 🎉

Este documento explica cómo colaborar en el desarrollo del backend API de la red social, construido con **NestJS**, **TypeScript** y **Supabase**.

---

## 📌 **Requisitos Previos**

Asegúrate de tener instalado:

- Node.js >= 18.x
- npm >= 9.x (o yarn/pnpm)
- Git
- Una cuenta de Supabase (para desarrollo local)

---

## 🚀 **Flujo de Trabajo Colaborativo**

## ⚙️ **Instalación del Entorno de Desarrollo**

Sigue estos pasos para configurar tu entorno de desarrollo:

### 1️⃣ **Haz un Fork**

Haz clic en **Fork** en la parte superior derecha para crear tu copia del repositorio en tu cuenta de GitHub.

---

### 2️⃣ **Clona tu fork**

```bash
# Clona TU fork (reemplaza <TU_USUARIO>)
git clone https://github.com/<TU_USUARIO>/social-network-webapp-backend.git
```

#### Entra a la carpeta del proyecto

```bash
cd social-network-webapp-backend
```

### Agrega el repositorio original como remoto "upstream"

```bash
git remote add upstream https://github.com/CodeCrafters-ES/social-network-webapp-backend.git
```

### 3️⃣ **Instala dependencias**

```bash
npm install
```

### 4️⃣ **Configura las variables de entorno**

Crea un archivo `.env` en la raíz del proyecto con la siguiente estructura:

```env
# Supabase Configuration
SUPABASE_URL=tu_supabase_project_url
SUPABASE_ANON_KEY=tu_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# JWT Configuration
JWT_SECRET=tu_jwt_secret_development

# Application
PORT=3000
NODE_ENV=development
```

### 5️⃣ **Inicia el servidor de desarrollo**

```bash
# Desarrollo con auto-reload
npm run start:dev

# Debug mode
npm run start:debug
```

La API estará disponible en <http://localhost:3000>

---

## 📁 **Estructura del Proyecto**

```
social-network-webapp-backend/
├── src/
│   ├── auth/                    # Módulo de autenticación
│   │   ├── dto/                # Data Transfer Objects (input/output)
│   │   │   ├── login.dto.ts
│   │   │   ├── register.dto.ts
│   │   │   └── update-user.dto.ts
│   │   ├── guards/             # Guards para protección de rutas
│   │   │   └── supabase-auth.guard.ts
│   │   ├── auth.controller.ts  # Controladores REST
│   │   ├── auth.service.ts     # Lógica de negocio
│   │   ├── auth.module.ts      # Definición del módulo
│   │   └── auth.controller.spec.ts
│   ├── config/                 # Configuración de servicios externos
│   │   └── supabase.config.ts
│   ├── common/                 # Utilidades compartidas
│   │   ├── decorators/         # Decoradores personalizados
│   │   ├── filters/           # Filtros de excepciones
│   │   ├── interceptors/      # Interceptores para logging/ transformación
│   │   ├── pipes/             # Pipes para validación/transformación
│   │   └── utils/             # Funciones helper
│   ├── modules/               # Módulos funcionales de la aplicación
│   │   ├── users/            # Gestión de usuarios
│   │   │   ├── dto/
│   │   │   ├── entities/     # Entidades de TypeORM (si usas)
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   └── users.module.ts
│   │   ├── posts/            # Gestión de publicaciones
│   │   ├── comments/         # Sistema de comentarios
│   │   └── notifications/    # Notificaciones push
│   ├── app.controller.ts     # Controlador raíz
│   ├── app.module.ts         # Módulo principal de la aplicación
│   ├── app.service.ts        # Servicio raíz
│   └── main.ts              # Punto de entrada de la aplicación
├── test/                    # Tests end-to-end
│   ├── app.e2e-spec.ts
│   └── jest-e2e.json
├── .env                     # Variables de entorno (NO COMMITEAR)
├── .env.example            # Template de variables de entorno
├── .gitignore
├── .prettierrc            # Configuración de Prettier
├── eslint.config.mjs      # Configuración de ESLint
├── nest-cli.json          # Configuración de NestJS CLI
├── package.json
├── tsconfig.json          # Configuración de TypeScript
└── README.md
```

---

## 👩‍💻 **Flujo de Trabajo Colaborativo**

### 1️⃣ **Mantén tu fork sincronizado**

Antes de empezar, actualiza tu rama development local con los últimos cambios:

```bash
# Cambia a development
git checkout development

# Obtén los últimos cambios del original
git fetch upstream

# Fusiona cambios en tu rama development
git merge upstream/development

# Sube tu rama development actualizada
git push origin development
```

### 2️⃣ **Crea una rama feature desde development**

```bash
git checkout -b feature/nombre-de-la-feature
```

Ejemplos de nombres de ramas:

```bash
git checkout -b feature/add-user-profile-endpoint
git checkout -b feature/implement-posts-module
git checkout -b fix/auth-validation-error
git checkout -b refactor/improve-error-handling
```

### 3️⃣ **Convenciones de Commit**

Usa **Conventional Commits** para mensajes claros y consistentes:

```bash
# Para nuevas funcionalidades
git commit -m "feat: agregar endpoint de registro de usuarios"

# Para correcciones
git commit -m "fix: corregir validación de email en login"

# Para refactorización
git commit -m "refactor: mejorar estructura de DTOs"

# Para documentación
git commit -m "docs: actualizar README con nuevos endpoints"

# Para tests
git commit -m "test: agregar tests para auth service"
```

### 4️⃣ **Trabaja en tu rama**

- Realiza los cambios necesarios
- Asegúrate de que los tests pasen: `npm run test`
- Verifica el linting: `npm run lint`
- Formatea el código: `npm run format`

### 5️⃣ **Sube tu rama feature**

```bash
git push origin feature/nombre-de-la-feature
```

### 6️⃣ **Crea un Pull Request**

1. Ve a la página de tu fork en GitHub
2. Haz clic en **Compare & Pull Request**
3. Selecciona tu rama feature como source y `development` del repositorio original como target
4. Completa la información del PR:
   - **Título**: Descriptivo y siguiendo conventional commits
   - **Descripción**: Explica qué hace el cambio y por qué
   - **Asignar revisores**: Menciona al equipo de backend
   - **Labels**: feat, fix, docs, etc.
   - **Linked Issues**: Si resuelve alguna issue específica

---

## 🧪 **Desarrollo y Testing**

### **Antes de hacer commit**

```bash
# Ejecuta los tests
npm run test

# Verifica cobertura
npm run test:cov

# Ejecuta el linter
npm run lint

# Formatea el código
npm run format
```

### **Testing**

- **Tests unitarios**: Para servicios, utilidades y lógica de negocio
- **Tests de integración**: Para controladores y módulos completos
- **E2E Tests**: Para flujos completos de la API

Ejemplo de test para un servicio:

```typescript
describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

---

## API Contract / OpenAPI

El spec de la API vive en `docs/openapi/openapi.yaml`. Spectral lo valida en CI y bloquea el merge si detecta errores.

### Ubicacion del spec

```
docs/openapi/openapi.yaml
```

### Lint local

Antes de abrir un PR, verifica que el spec no tenga errores:

```bash
pnpm run lint:api
```

### Flujo al añadir o modificar un endpoint

1. Actualiza `docs/openapi/openapi.yaml` con los cambios del endpoint (path, parametros, responses, schemas).
2. Ejecuta `pnpm run lint:api` y corrige cualquier error que reporte Spectral.
3. Abre el PR. El job `spectral_lint` en CI volverá a validar el spec — si falla, el merge queda bloqueado.

El spec debe actualizarse en el mismo PR que el codigo del endpoint, nunca en un PR separado posterior.

---

## ✅ **Scripts Disponibles**

| Script | Descripción |
|--------|-------------|
| `npm run start:dev` | Servidor de desarrollo con auto-reload |
| `npm run start:debug` | Servidor en modo debug |
| `npm run start:prod` | Compila y ejecuta en producción |
| `npm run build` | Compila la aplicación |
| `npm run test` | Ejecuta tests unitarios |
| `npm run test:watch` | Tests en modo watch |
| `npm run test:cov` | Tests con reporte de cobertura |
| `npm run test:debug` | Tests en modo debug |
| `npm run test:e2e` | Tests end-to-end |
| `npm run lint` | Ejecuta ESLint |
| `npm run format` | Formatea código con Prettier |

---

## 📝 **Pautas de Desarrollo**

### **Código**

- Usa **TypeScript** para todo el código nuevo
- Sigue las **convenciones de NestJS**
- Usa **DTOs** para validar inputs y tipar responses
- Implementa **guards** para proteger rutas
- Usa **decorators** para metadata y validación
- Maneja errores con **exception filters**

### **Commits**

- Mensajes en **español** o **inglés** (elige uno y sé consistente)
- Usa **Conventional Commits** para categorización automática
- Primera línea: máximo 50 caracteres
- Descripción detallada si es necesario

### **Pull Requests**

- Siempre apuntar a la rama `development`
- Incluir descripción clara del cambio
- Mencionar si resuelve alguna issue
- Asignar revisores apropiados
- Esperar al menos 1 aprobación antes de merge

---

## 🔒 **Configuración de Supabase**

Para desarrollo local necesitas:

1. **Crear un proyecto en Supabase**
2. **Configurar autenticación** (email/password)
3. **Obtener las credenciales** del proyecto
4. **Configurar las variables de entorno**

### **Variables de entorno requeridas**

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
JWT_SECRET=tu-jwt-secret-super-seguro
```

---

## 🚨 **Issues y Reportes**

### **Crear una Issue**

1. Usa **templates** si están disponibles
2. Describe el problema con detalle
3. Incluye pasos para reproducir
4. Especifica la versión de Node.js y SO
5. Agrega logs de error si corresponde

### **Tipos de Issues**

- 🐛 **Bug**: Algo no funciona como esperado
- ✨ **Feature**: Nueva funcionalidad
- 📚 **Documentation**: Mejoras en docs
- 🔧 **Enhancement**: Mejora de funcionalidad existente
- 🧪 **Test**: Agregar tests

---

## 📞 **Contacto y Comunicación**

- **Issues**: Para bugs y features
- **Discussions**: Para preguntas y debates
- **PRs**: Para contribuciones de código
- **Wiki**: Para documentación extensa

---

## 🎯 **Mejores Prácticas**

### **Desarrollo**

1. **Escribe tests** antes de implementar funcionalidades
2. **Usa DTOs** para validación de datos
3. **Implementa logging** apropiado
4. **Maneja errores** de forma consistente
5. **Documenta APIs** con Swagger/OpenAPI

### **Seguridad**

1. **Nunca commitear** credenciales reales
2. **Usar variables de entorno** para configuración sensible
3. **Validar inputs** en todos los endpoints
4. **Implementar rate limiting** para APIs públicas
5. **Usar HTTPS** en producción

---

## 📈 **Progreso y Estado**

- 🏗️ **En Desarrollo Activo**
- 📦 **Módulos implementados**: Auth
- 🔄 **Próximos módulos**: Users, Posts, Comments
- 🧪 **Cobertura de tests**: En crecimiento

---

**✅ Diferencias clave con frontend:**

- **Rama principal**: `development` (no `dev`)
- **Enfoque**: API RESTful + lógica de negocio
- **Testing**: Unit tests + Integration tests + E2E
- **Configuración**: Variables de entorno para servicios externos
- **Commits**: Seguimos conventional commits para changelog automático
- **PRs**: Siempre contra `development` del repositorio original