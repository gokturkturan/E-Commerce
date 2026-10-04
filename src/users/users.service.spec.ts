import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;

  const mockUserRepository = {
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByEmail', () => {
    it('should return the user when found', async () => {
      const user = { id: '1', email: 'test@test.com' };
      mockUserRepository.findOneBy.mockResolvedValue(user);

      const result = await service.findByEmail('test@test.com');

      expect(mockUserRepository.findOneBy).toHaveBeenCalledWith({
        email: 'test@test.com',
      });
      expect(result).toEqual(user);
    });

    it('should return null when not found', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(null);

      const result = await service.findByEmail('missing@test.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return the user when found', async () => {
      const user = { id: '1', email: 'test@test.com' };
      mockUserRepository.findOneBy.mockResolvedValue(user);

      const result = await service.findById('1');

      expect(mockUserRepository.findOneBy).toHaveBeenCalledWith({ id: '1' });
      expect(result).toEqual(user);
    });
  });

  describe('create', () => {
    it('should create and save a new user', async () => {
      const data = { email: 'new@test.com', password: 'hashed' };
      const createdEntity = { ...data };
      const savedEntity = { id: '1', ...data };

      mockUserRepository.create.mockReturnValue(createdEntity);
      mockUserRepository.save.mockResolvedValue(savedEntity);

      const result = await service.create(data);

      expect(mockUserRepository.create).toHaveBeenCalledWith(data);
      expect(mockUserRepository.save).toHaveBeenCalledWith(createdEntity);
      expect(result).toEqual(savedEntity);
    });
  });
});
