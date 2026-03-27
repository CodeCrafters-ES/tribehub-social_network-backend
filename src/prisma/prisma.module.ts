// src/prisma/prisma.module.ts
//
// Por qué isGlobal: true:
//   Al marcar el módulo como global, NestJS registra PrismaService en el
//   contenedor de inyección de dependencias de manera que cualquier otro
//   módulo puede inyectarlo SIN necesidad de importar PrismaModule
//   explícitamente en cada módulo de dominio.
//
//   Esto es correcto porque PrismaService es infraestructura compartida,
//   no lógica de negocio de un dominio concreto. La alternativa (importarlo
//   en cada módulo) sería repetición innecesaria.
//
// Por qué exports: [PrismaService]:
//   Aunque el módulo sea global, NestJS requiere que declares qué providers
//   exporta para que puedan ser inyectados fuera del módulo.

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
