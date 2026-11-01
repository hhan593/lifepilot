import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { setupApp } from './setup-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  setupApp(app);
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  app.enableCors({
    origin: (config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000').split(','),
    credentials: true,
  });

  if (process.env.NODE_ENV !== 'production') {
    const doc = new DocumentBuilder()
      .setTitle('LifePilot API')
      .setDescription('生活助手 API：天气 / 待办 / 喝水 / 习惯 / 周报')
      .setVersion('0.1')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc));
  }

  await app.listen(config.get<number>('PORT') ?? 4000);
}

void bootstrap();
