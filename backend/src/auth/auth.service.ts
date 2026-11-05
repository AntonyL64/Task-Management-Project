import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export type PublicUser = Omit<User, 'passwordHash'>;

export interface AuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: PublicUser;
}

const MIN_BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly rounds: number;
  /** Hash giả để so sánh khi email không tồn tại, giúp thời gian phản hồi như nhau. */
  private readonly dummyHash: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    // DoD: bcrypt >= 10 rounds. Cấu hình thấp hơn vẫn bị nâng lên 10.
    this.rounds = Math.max(MIN_BCRYPT_ROUNDS, Number(config.get('BCRYPT_ROUNDS')) || MIN_BCRYPT_ROUNDS);
    this.dummyHash = bcrypt.hashSync('dummy-password-for-timing', this.rounds);
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const passwordHash = await bcrypt.hash(dto.password, this.rounds);
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          displayName: dto.displayName,
          ...(dto.timezone && { timezone: dto.timezone }),
          // Tạo sẵn cấu hình lập lịch mặc định để Scheduler luôn có settings.
          schedulerSetting: { create: {} },
        },
      });
      return this.issueToken(user);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Email đã được sử dụng');
      }
      throw e;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const ok = await bcrypt.compare(dto.password, user?.passwordHash ?? this.dummyHash);
    // Cùng một thông báo cho sai email và sai mật khẩu: không lộ email nào đã đăng ký.
    if (!user || !ok) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    return this.issueToken(user);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return toPublicUser(user);
  }

  private async issueToken(user: User): Promise<AuthResponse> {
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email });
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN') ?? '1d',
      user: toPublicUser(user),
    };
  }
}

export function toPublicUser(user: User): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...rest } = user;
  return rest;
}
