import { Controller, Get, Global, Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class DatabaseHealthService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  status() {
    const connected = this.connection.readyState === 1;
    return {
      status: connected ? 'up' : 'down',
      database: 'mongodb',
      connected,
    };
  }
}

@Controller('health')
export class DatabaseHealthController {
  constructor(private readonly health: DatabaseHealthService) {}

  @Get('database')
  status() {
    return this.health.status();
  }
}

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
      }),
    }),
  ],
  controllers: [DatabaseHealthController],
  providers: [DatabaseHealthService],
  exports: [MongooseModule, DatabaseHealthService],
})
export class DatabaseModule {}
