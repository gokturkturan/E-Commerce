import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { RefreshToken } from './entities/refresh-token.entity';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import ms from 'ms';
import { createHash } from 'crypto';

const SALT_ROUNDS = 10;

// bcrypt silently truncates its input to 72 bytes, which made every
// refresh token for the same user hash identically (they all share the
// same header + "sub" prefix within the first 72 bytes). Refresh tokens
// are already high-entropy random strings, so we don't need bcrypt's
// slow, salted hashing here — a plain fast hash is both correct and
// sufficient.
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('This email is already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.usersService.create({
      email: dto.email,
      password: hashedPassword,
    });

    return this.generateTokens(user);
  }

  async login(dto: LoginDto): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.generateTokens(user);
  }

  private async generateTokens(user: User): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const refreshExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      { secret: refreshSecret, expiresIn: refreshExpiresIn as any },
    );

    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + ms(refreshExpiresIn as any));

    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({ user, tokenHash, expiresAt }),
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    let payload: { sub: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const matchedToken = await this.refreshTokenRepository.findOne({
      where: { user: { id: payload.sub }, tokenHash: hashToken(refreshToken) },
    });

    if (!matchedToken) {
      throw new UnauthorizedException('Refresh token not recognized');
    }

    await this.refreshTokenRepository.delete(matchedToken.id);

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return this.generateTokens(user);
  }

  async logout(refreshToken: string) {
    const payload = this.jwtService.decode(refreshToken) as {
      sub: string;
    } | null;

    if (!payload?.sub) {
      return;
    }

    const matchedToken = await this.refreshTokenRepository.findOne({
      where: { user: { id: payload.sub }, tokenHash: hashToken(refreshToken) },
    });

    if (matchedToken) {
      await this.refreshTokenRepository.delete(matchedToken.id);
    }
  }
}
