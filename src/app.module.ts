import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Load the env file that matches the current NODE_ENV.
      // Fallback to .env.development so local dev works without setting NODE_ENV.
      // In Railway (production/staging), the platform injects env vars directly
      // into process.env before the process starts, so the file may not exist —
      // ignoreEnvFile: false is intentional: if the file is missing ConfigModule
      // simply finds nothing and defers to whatever is already in process.env.
      envFilePath: `.env.${process.env.NODE_ENV ?? 'development'}`,
    }),
    PrismaModule, // Global: PrismaService queda disponible en toda la app
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
