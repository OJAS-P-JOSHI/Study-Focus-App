import {
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Module,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { JwtModule, JwtService } from '@nestjs/jwt';

import { InjectModel, MongooseModule } from '@nestjs/mongoose';

import { AuthGuard, PassportModule } from '@nestjs/passport';

import { PassportStrategy } from '@nestjs/passport';

import { Model } from 'mongoose';

import { ExtractJwt, Strategy } from 'passport-jwt';

import { IsEmail, IsString, Length, MinLength } from 'class-validator';

import * as bcrypt from 'bcrypt';

import type { AuthUser } from './common';
import { CurrentUser } from './common';

import {
  User,
  UserDocument,
  UserSchema,
  UserSettings,
  UserSettingsDocument,
  UserSettingsSchema,
} from './schemas';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(2, 80)
  name!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

interface TokenPayload {
  sub: string;

  email: string;

  type: 'access' | 'refresh';
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      secretOrKey: config.getOrThrow('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: TokenPayload): AuthUser {
    if (payload.type !== 'access') throw new UnauthorizedException();

    return { id: payload.sub, email: payload.email };
  }
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,

    @InjectModel(UserSettings.name)
    private readonly settings: Model<UserSettingsDocument>,

    private readonly jwt: JwtService,

    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    if (await this.users.findOne({ email }).lean()) {
      throw new ConflictException('Email is already registered');
    }

    const user = await this.users.create({
      email,

      name: dto.name.trim(),

      passwordHash: await bcrypt.hash(dto.password, 12),
    });

    try {
      await this.settings.create({ userId: user._id });
    } catch (error) {
      await this.users.deleteOne({ _id: user._id });
      throw error;
    }

    const profile = this.publicUser(user);

    return {
      user: profile,
      ...(await this.issueTokens(user._id.toString(), user.email)),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.users
      .findOne({
        email: dto.email.trim().toLowerCase(),
      })
      .select('+passwordHash');

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.issueTokens(user._id.toString(), user.email);

    return { user: this.publicUser(user), ...tokens };
  }

  async refresh(rawToken: string) {
    let payload: TokenPayload;

    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(rawToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh')
      throw new UnauthorizedException('Invalid refresh token');

    const user = await this.users
      .findById(payload.sub)
      .select('+refreshTokenHash');

    if (
      !user?.refreshTokenHash ||
      !(await bcrypt.compare(rawToken, user.refreshTokenHash))
    ) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    return this.issueTokens(user._id.toString(), user.email);
  }

  async logout(userId: string): Promise<{ loggedOut: true }> {
    await this.users.findByIdAndUpdate(userId, { refreshTokenHash: null });

    return { loggedOut: true };
  }

  async me(userId: string) {
    const user = await this.users.findById(userId);

    if (!user) throw new UnauthorizedException();

    return this.publicUser(user, true);
  }

  private publicUser(user: UserDocument, includeTimestamps = false) {
    const base = {
      id: user._id.toString(),

      email: user.email,

      name: user.name,

      timezone: user.timezone,
    };

    if (!includeTimestamps) return base;

    return {
      ...base,

      createdAt: user.createdAt,

      updatedAt: user.updatedAt,
    };
  }

  private async issueTokens(userId: string, email: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, type: 'access' } satisfies TokenPayload,

      {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),

        expiresIn: this.config.get(
          'JWT_ACCESS_EXPIRES_IN',
          '15m',
        ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: userId, email, type: 'refresh' } satisfies TokenPayload,

      {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),

        expiresIn: this.config.get(
          'JWT_REFRESH_EXPIRES_IN',
          '30d',
        ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );

    await this.users.findByIdAndUpdate(userId, {
      refreshTokenHash: await bcrypt.hash(refreshToken, 12),
    });

    return { accessToken, refreshToken };
  }
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser() user: AuthUser) {
    return this.auth.logout(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}

@Module({
  imports: [
    PassportModule,

    JwtModule.register({}),

    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },

      { name: UserSettings.name, schema: UserSettingsSchema },
    ]),
  ],

  controllers: [AuthController],

  providers: [AuthService, JwtStrategy, JwtAuthGuard],

  exports: [JwtAuthGuard, MongooseModule],
})
export class AuthModule {}
