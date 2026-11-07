import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  configureApp(app);
  app.enableCors({
    origin: (config.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173').split(','),
  });
  app.enableShutdownHooks();

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
  console.log(`API chạy tại http://localhost:${port}/api`);
}
bootstrap();
