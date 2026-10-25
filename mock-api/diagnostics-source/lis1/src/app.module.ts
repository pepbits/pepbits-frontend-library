import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dbOptions } from './database';
import { JwtAuthGuard } from './common/auth';
import { LabModule } from './lab/lab.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => dbOptions() }),
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: '12h' } }),
    }),
    LabModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
