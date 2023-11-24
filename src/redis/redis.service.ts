import { Injectable, Inject } from '@nestjs/common';
import { RedisClientType } from 'redis';

@Injectable()
export class RedisService {
  @Inject('REDIS_CLIENT')
  private readonly client: RedisClientType;

  async get(key: string) {
    return await this.client.get(key);
  }

  async set(key: string, value: string | number, ttl: number) {
    await this.client.set(key, value);
    if (ttl) {
      await this.client.expire(key, ttl);
    }
  }
}
