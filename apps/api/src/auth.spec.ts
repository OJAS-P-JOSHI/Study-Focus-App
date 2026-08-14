jest.mock('./schemas', () => ({
  User: { name: 'User' },
  UserDocument: class UserDocument {},
  UserSchema: {},
  UserSettings: { name: 'UserSettings' },
  UserSettingsDocument: class UserSettingsDocument {},
  UserSettingsSchema: {},
}));

import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth';

function chainable(result: unknown) {
  const chain = {
    lean: jest.fn().mockResolvedValue(result),
    select: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(result),
  };
  chain.select.mockImplementation(() => ({
    ...chain,
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(result).then(resolve),
  }));
  return chain;
}

describe('AuthService', () => {
  const users = {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
  };
  const settings = {
    create: jest.fn(),
  };
  const jwt = {
    verifyAsync: jest.fn(),
    signAsync: jest.fn(),
  };
  const config = {
    getOrThrow: jest.fn((key: string) => key),
    get: jest.fn((_key: string, fallback: string) => fallback),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jwt.signAsync.mockResolvedValue('token');
    users.findByIdAndUpdate.mockResolvedValue(undefined);
  });

  it('does not reveal whether an unknown login email exists', async () => {
    const service = new AuthService(
      users as never,
      settings as never,
      jwt as never,
      config as never,
    );
    users.findOne.mockReturnValue(chainable(null));
    await expect(
      service.login({ email: 'nobody@example.com', password: 'password' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects duplicate registration before hashing', async () => {
    const service = new AuthService(
      users as never,
      settings as never,
      jwt as never,
      config as never,
    );
    users.findOne.mockReturnValue(chainable({ id: 'existing' }));
    await expect(
      service.register({
        email: 'USER@example.com',
        name: 'User',
        password: 'password',
      }),
    ).rejects.toThrow(ConflictException);
    expect(users.create).not.toHaveBeenCalled();
  });

  it('rejects a refresh token with no matching stored hash', async () => {
    const service = new AuthService(
      users as never,
      settings as never,
      jwt as never,
      config as never,
    );
    jwt.verifyAsync.mockResolvedValue({
      sub: 'user-id',
      email: 'user@example.com',
      type: 'refresh',
    });
    users.findById.mockReturnValue(
      chainable({
        id: 'user-id',
        email: 'user@example.com',
        refreshTokenHash: null,
      }),
    );
    await expect(service.refresh('revoked-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
