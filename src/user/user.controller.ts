import { Controller, Body, Get, Post, Inject, Query, UnauthorizedException } from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { RedisService } from 'src/redis/redis.service';
import { EmailService } from 'src/email/email.service';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LoginUserVo } from './vo/login-user.vo';
import { UserInfo, RequireLogin } from 'src/decorator/customer.decorator';
import { UserDetailVo } from './vo/user-detail.vo';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
@Controller('user')
export class UserController {
  @Inject()
  private readonly redisService: RedisService;

  @Inject()
  private readonly emailService: EmailService;

  @Inject()
  private readonly jwtService: JwtService;

  @Inject()
  private readonly configService: ConfigService;

  constructor(private readonly userService: UserService) {}

  private generateTokens(vo: LoginUserVo) {
    vo.accessToken = this.jwtService.sign(
      {
        username: vo.userInfo.username,
        userId: vo.userInfo.id,
        roles: vo.userInfo.roles,
        permissions: vo.userInfo.permissions
      },
      {
        expiresIn: this.configService.get('jwt_access_token_expires_time')
      }
    );

    vo.refreshToken = this.jwtService.sign(
      {
        userId: vo.userInfo.id
      },
      {
        expiresIn: this.configService.get('jwt_refresh_token_expres_time')
      }
    );
  }

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

  @Get('init-data')
  async initData() {
    await this.userService.initData();
    return '初始化成功';
  }

  @Post('login')
  async login(@Body() loginDto: LoginUserDto) {
    const vo = await this.userService.login(loginDto, false);

    this.generateTokens(vo);

    return vo;
  }

  @Post('admin/login')
  async adminLogin(@Body() loginDto: LoginUserDto) {
    const vo = await this.userService.login(loginDto, true);
    this.generateTokens(vo);

    return vo;
  }

  @Get('refresh')
  async refresh(@Query('refreshToken') refreshToken: string) {
    try {
      const data = this.jwtService.verify(refreshToken);
      const user = await this.userService.findUserById(data.userId, false);
      const refresh = this.jwtService.sign(
        {
          username: user.username,
          userId: user.id,
          roles: user.roles,
          permissions: user.permissions
        },
        {
          expiresIn: this.configService.get('jwt_access_token_expires_time') || '30m'
        }
      );
      return {
        accessToken: refresh
      };
    } catch (error) {
      throw new UnauthorizedException('refreshToken无效');
    }
  }

  @Get('admin/refresh')
  async adminRefresh(@Query('refreshToken') refreshToken: string) {
    try {
      const data = this.jwtService.verify(refreshToken);

      const user = await this.userService.findUserById(data.userId, true);

      const access_token = this.jwtService.sign(
        {
          userId: user.id,
          username: user.username,
          roles: user.roles,
          permissions: user.permissions
        },
        {
          expiresIn: this.configService.get('jwt_access_token_expires_time') || '30m'
        }
      );

      return {
        access_token
      };
    } catch (e) {
      throw new UnauthorizedException('token 已失效，请重新登录');
    }
  }

  @Get('info')
  @RequireLogin()
  async info(@UserInfo('userId') userId: number) {
    const user = await this.userService.findUserDetailById(userId);
    const vo = new UserDetailVo();
    vo.id = user.id;
    vo.email = user.email;
    vo.username = user.username;
    vo.headPic = user.headPic;
    vo.phoneNumber = user.phoneNumber;
    vo.nickName = user.nickName;
    vo.createTime = user.createTime;
    vo.isFrozen = user.isFrozen;
    return vo;
  }

  @Post(['update_password', 'admin/update_password'])
  @RequireLogin()
  async updatePassword(@UserInfo('userId') userId: number, @Body() passwordDto: UpdateUserPasswordDto) {
    return await this.userService.updatePassword(userId, passwordDto);
  }

  @Get('update_password/captcha')
  async updatePasswordCaptcha(@Query('address') address: string) {
    const code = Math.random().toString().slice(2, 8);

    await this.redisService.set(`update_password_captcha_${address}`, code, 10 * 60);

    // await this.emailService.sendMail({
    //   to: address,
    //   subject: '更改密码验证码',
    //   html: `<p>你的更改密码验证码是 ${code}</p>`
    // });
    return '发送成功';
  }
}
