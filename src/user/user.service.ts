import { Injectable, Inject, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { RegisterUserDto } from './dto/register-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { RedisService } from 'src/redis/redis.service';
import { md5 } from 'src/utils';
import { LoginUserDto } from './dto/login-user.dto';
import { LoginUserVo } from './vo/login-user.vo';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
@Injectable()
export class UserService {
  private readonly logger = new Logger();

  @InjectRepository(User)
  private readonly userRepository: Repository<User>;

  @InjectRepository(Role)
  private readonly roleRepository: Repository<Role>;

  @InjectRepository(Permission)
  private readonly permissionRepository: Repository<Permission>;

  @Inject()
  private readonly redisService: RedisService;

  constructor() {}

  async initData() {
    const user1 = new User();
    user1.username = 'zhangsan';
    user1.password = md5('111111');
    user1.email = 'xxx@xx.com';
    user1.isAdmin = true;
    user1.nickName = '张三';
    user1.phoneNumber = '13233323333';

    const user2 = new User();
    user2.username = 'lisi';
    user2.password = md5('222222');
    user2.email = 'yy@yy.com';
    user2.nickName = '李四';

    const role1 = new Role();
    role1.name = '管理员';

    const role2 = new Role();
    role2.name = '普通用户';

    const permission1 = new Permission();
    permission1.code = 'ccc';
    permission1.description = '访问 ccc 接口';

    const permission2 = new Permission();
    permission2.code = 'ddd';
    permission2.description = '访问 ddd 接口';

    user1.roles = [role1];
    user2.roles = [role2];

    role1.permissions = [permission1, permission2];
    role2.permissions = [permission1];

    await this.permissionRepository.save([permission1, permission2]);
    await this.roleRepository.save([role1, role2]);
    await this.userRepository.save([user1, user2]);
  }

  async register(user: RegisterUserDto) {
    const captcha = await this.redisService.get(`captcha_` + user.email);

    if (!captcha) {
      throw new HttpException('验证码已过期', HttpStatus.BAD_REQUEST);
    }

    if (captcha !== user.captcha) {
      throw new HttpException('验证码错误', HttpStatus.BAD_REQUEST);
    }

    const foundUser = await this.userRepository.findOneBy({
      username: user.username
    });

    if (foundUser) {
      throw new HttpException('用户名已存在', HttpStatus.BAD_REQUEST);
    }

    const { username, password, email, nickName } = user;
    const newUser = new User();
    newUser.username = username;
    newUser.password = md5(password);
    newUser.email = email;
    newUser.nickName = nickName;

    try {
      await this.userRepository.save(newUser);
      return '注册成功';
    } catch (error) {
      this.logger.error(error);
      return '注册失败';
    }
  }

  async login(user: LoginUserDto, isAdmin: boolean) {
    const { username, password } = user;
    const foundUser = await this.userRepository.findOne({
      where: {
        username: username,
        isAdmin
      },
      relations: ['roles', 'roles.permissions']
    });

    if (!foundUser) {
      throw new HttpException('用户名不存在', HttpStatus.BAD_REQUEST);
    }

    if (md5(password) !== foundUser.password) {
      throw new HttpException('密码错误', HttpStatus.BAD_REQUEST);
    }

    const vo = new LoginUserVo();
    vo.userInfo = {
      id: foundUser.id,
      username: foundUser.username,
      nickName: foundUser.nickName,
      email: foundUser.email,
      phoneNumber: foundUser.phoneNumber,
      headPic: foundUser.headPic,
      createTime: foundUser.createTime.getTime(),
      isFrozen: foundUser.isFrozen,
      isAdmin: foundUser.isAdmin,
      roles: foundUser.roles.map(item => item.name),
      permissions: foundUser.roles.reduce((arr, item) => {
        item.permissions.forEach(permission => {
          if (arr.indexOf(permission) === -1) {
            arr.push(permission);
          }
        });
        return arr;
      }, [])
    };
    return vo;
  }

  async findUserById(id: number, isAdmin: boolean) {
    const user = await this.userRepository.findOne({
      where: {
        id,
        isAdmin
      },
      relations: ['roles', 'roles.permissions']
    });
    return {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      roles: user.roles.map(item => item.name),
      permissions: user.roles.reduce((arr, item) => {
        item.permissions.forEach(permission => {
          if (arr.indexOf(permission) === -1) {
            arr.push(permission);
          }
        });
        return arr;
      }, [])
    };
  }

  async findUserDetailById(userId: number) {
    const user = await this.userRepository.findOne({
      where: {
        id: userId
      }
    });
    return user;
  }

  async updatePassword(userId: number, passwordDto: UpdateUserPasswordDto) {
    const cache = await this.redisService.get(`update_password_captcha_` + passwordDto.email);

    if (!cache) {
      throw new HttpException('验证码已过期', HttpStatus.BAD_REQUEST);
    }

    if (passwordDto.captcha !== cache) {
      throw new HttpException('验证码错误', HttpStatus.BAD_REQUEST);
    }

    const user = await this.userRepository.findOne({
      where: {
        id: userId
      }
    });

    try {
      user.password = md5(passwordDto.password);
      await this.userRepository.save(user);
      return '密码修改成功';
    } catch (error) {
      return error;
    }
  }

  async freezeUser(userId: number) {
    const user = await this.userRepository.findOneBy({ id: userId });

    if (!user) {
      throw new HttpException('用户不存在', HttpStatus.BAD_REQUEST);
    }

    user.isFrozen = true;

    await this.userRepository.save(user);
  }

  async findUserByCount(pageNo: number, pageSize: number) {
    const skinCount = (pageNo - 1) * pageSize;
    const [users, totalCount] = await this.userRepository.findAndCount({
      skip: skinCount,
      take: pageSize
    });
    return { users, totalCount };
  }
}
