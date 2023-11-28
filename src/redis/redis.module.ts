import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { createClient } from 'redis';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  providers: [
    RedisService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: async (configService: ConfigService) => {
        const host = configService.get('redis_server_host');
        const port = configService.get('redis_server_port');
        const db = configService.get('redis_server_db');
        const client = createClient({
          socket: {
            host: host,
            port: port
          },
          database: db
        });
        await client.connect();
        return client;
      },
      inject: [ConfigService]
    }
  ],
  exports: [RedisService]
})
export class RedisModule {}
