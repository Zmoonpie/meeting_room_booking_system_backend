import { Controller, Body, Get, Post, Inject, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { RedisService } from 'src/redis/redis.service';
import { EmailService } from 'src/email/email.service';

@Controller('user')
export class UserController {
  @Inject()
  private readonly redisService: RedisService;

  @Inject()
  private readonly emailService: EmailService;

  constructor(private readonly userService: UserService) {}

  @Post('register')
  async register(@Body() registerUserDto: RegisterUserDto) {
    return await this.userService.register(registerUserDto);
  }

  @Get('register-captcha')
  async registerCaptcha(@Query('email') email: string) {
    const code = Math.random().toString().slice(2, 8);
    await this.redisService.set(`captcha_` + email, code, 60 * 5);

    // await this.emailService.sendEmail({
    //   to: email,
    //   subject: '注册验证码',
    //   html: `<p>你的注册验证码是 ${code}</p>`
    // });

    return '验证码已发送';
  }
}
