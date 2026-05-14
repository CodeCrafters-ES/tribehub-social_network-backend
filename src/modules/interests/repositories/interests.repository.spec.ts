// src/modules/interests/repositories/interests.repository.spec.ts

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { InterestsRepository } from './interests.repository';

const mockInterest = {
  findMany: vi.fn(),
};

const mockUserInterest = {
  findMany: vi.fn(),
  deleteMany: vi.fn(),
  createMany: vi.fn(),
};

const mockPrismaService = {
  interest: mockInterest,
  userInterest: mockUserInterest,
  $transaction: vi.fn(),
};

describe('InterestsRepository', () => {
  let repository: InterestsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new InterestsRepository(mockPrismaService as never);
  });

  describe('findAllValidated', () => {
    it('calls prisma.interest.findMany with status VALIDATED ordered by name', async () => {
      mockInterest.findMany.mockResolvedValue([]);

      await repository.findAllValidated();

      expect(mockInterest.findMany).toHaveBeenCalledOnce();
      expect(mockInterest.findMany).toHaveBeenCalledWith({
        where: { status: 'VALIDATED' },
        orderBy: { name: 'asc' },
      });
    });

    it('includes category filter when provided', async () => {
      mockInterest.findMany.mockResolvedValue([]);

      await repository.findAllValidated('Tech');

      expect(mockInterest.findMany).toHaveBeenCalledWith({
        where: { status: 'VALIDATED', category: 'Tech' },
        orderBy: { name: 'asc' },
      });
    });

    it('returns the array returned by prisma', async () => {
      const interests = [
        {
          id: 'uuid-1',
          name: 'Tech',
          slug: 'tech',
          category: 'Tech',
          status: 'VALIDATED',
        },
      ];
      mockInterest.findMany.mockResolvedValue(interests);

      const result = await repository.findAllValidated();

      expect(result).toEqual(interests);
    });
  });

  describe('findManyByIds', () => {
    it('calls prisma.interest.findMany with id in the provided array', async () => {
      mockInterest.findMany.mockResolvedValue([]);
      const ids = ['uuid-1', 'uuid-2'];

      await repository.findManyByIds(ids);

      expect(mockInterest.findMany).toHaveBeenCalledOnce();
      expect(mockInterest.findMany).toHaveBeenCalledWith({
        where: { id: { in: ids } },
      });
    });

    it('returns the interests found', async () => {
      const interests = [
        {
          id: 'uuid-1',
          name: 'Tech',
          slug: 'tech',
          category: 'Tech',
          status: 'VALIDATED',
        },
      ];
      mockInterest.findMany.mockResolvedValue(interests);

      const result = await repository.findManyByIds(['uuid-1']);

      expect(result).toEqual(interests);
    });
  });

  describe('getUserInterests', () => {
    it('calls prisma.userInterest.findMany with userId and includes interest', async () => {
      mockUserInterest.findMany.mockResolvedValue([]);

      await repository.getUserInterests('user-uuid');

      expect(mockUserInterest.findMany).toHaveBeenCalledOnce();
      expect(mockUserInterest.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-uuid' },
        include: { interest: true },
      });
    });

    it('maps rows to InterestItem shape including slug', async () => {
      const rows = [
        {
          userId: 'user-uuid',
          interestId: 'uuid-1',
          createdAt: new Date(),
          interest: {
            id: 'uuid-1',
            name: 'Technology',
            slug: 'technology',
            category: 'Tech',
            status: 'VALIDATED',
          },
        },
      ];
      mockUserInterest.findMany.mockResolvedValue(rows);

      const result = await repository.getUserInterests('user-uuid');

      expect(result).toEqual([
        {
          id: 'uuid-1',
          name: 'Technology',
          slug: 'technology',
          category: 'Tech',
          status: 'VALIDATED',
        },
      ]);
    });
  });

  describe('setUserInterests', () => {
    it('runs deleteMany and createMany inside a transaction', async () => {
      const deleteManyOp = Symbol('deleteMany');
      const createManyOp = Symbol('createMany');
      mockUserInterest.deleteMany.mockReturnValue(deleteManyOp);
      mockUserInterest.createMany.mockReturnValue(createManyOp);
      mockPrismaService.$transaction.mockResolvedValue(undefined);

      await repository.setUserInterests('user-uuid', ['uuid-1', 'uuid-2']);

      expect(mockUserInterest.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-uuid' },
      });
      expect(mockUserInterest.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 'user-uuid', interestId: 'uuid-1' },
          { userId: 'user-uuid', interestId: 'uuid-2' },
        ],
        skipDuplicates: true,
      });
      expect(mockPrismaService.$transaction).toHaveBeenCalledWith([
        deleteManyOp,
        createManyOp,
      ]);
    });

    it('handles empty interestIds array', async () => {
      const deleteManyOp = Symbol('deleteMany');
      const createManyOp = Symbol('createMany');
      mockUserInterest.deleteMany.mockReturnValue(deleteManyOp);
      mockUserInterest.createMany.mockReturnValue(createManyOp);
      mockPrismaService.$transaction.mockResolvedValue(undefined);

      await repository.setUserInterests('user-uuid', []);

      expect(mockUserInterest.createMany).toHaveBeenCalledWith({
        data: [],
        skipDuplicates: true,
      });
    });
  });
});
