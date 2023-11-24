import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { createClient } from 'redis';

@Global()
@Module({
  providers: [
    RedisService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: async () => {
        const client = createClient({
          socket: {
            host: 'localhost',
            port: 6379
          },
          database: 1
        });
        client.connect();
        return client;
      }
    }
  ],
  exports: [RedisService]
})
export class RedisModule {}