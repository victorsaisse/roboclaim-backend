import { NestFactory } from '@nestjs/core';
import { AppModule } from 'src/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(parseInt(process.env.PORT!));
  console.log(`[OK] Server is running on port ${process.env.PORT}`);
}
void bootstrap();
