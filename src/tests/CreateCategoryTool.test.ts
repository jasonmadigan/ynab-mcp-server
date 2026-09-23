import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { z } from 'zod';
import * as ynab from 'ynab';
import * as CreateCategoryTool from '../tools/CreateCategoryTool';

vi.mock('ynab');

describe('CreateCategoryTool', () => {
  let mockApi: {
    categories: {
      createCategory: Mock;
    };
  };

  const createdCategory = {
    id: 'category-new',
    category_group_id: 'group-1',
    category_group_name: 'Monthly Subscriptions',
    name: 'Gym Membership',
    hidden: false,
    internal: false,
    note: null,
    budgeted: 0,
    activity: 0,
    balance: 0,
    goal_type: null,
    goal_target: null,
    deleted: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockApi = {
      categories: {
        createCategory: vi.fn(),
      },
    };

    (ynab.API as any).mockImplementation(() => mockApi);

    process.env.YNAB_API_TOKEN = 'test-token';
    process.env.YNAB_BUDGET_ID = 'test-budget-id';
  });

  describe('execute', () => {
    it('creates the category in the given group and returns its id', async () => {
      mockApi.categories.createCategory.mockResolvedValue({
        data: { category: createdCategory, server_knowledge: 101 },
      });

      const result = await CreateCategoryTool.execute(
        {
          budgetId: 'test-budget-id',
          categoryGroupId: 'group-1',
          name: 'Gym Membership',
        },
        mockApi as any
      );

      expect(mockApi.categories.createCategory).toHaveBeenCalledWith(
        'test-budget-id',
        { category: { name: 'Gym Membership', category_group_id: 'group-1' } }
      );

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.category.id).toBe('category-new');
      expect(response.category.name).toBe('Gym Membership');
      expect(response.category.category_group_id).toBe('group-1');
    });

    it('converts the goal target from euros to milliunits', async () => {
      mockApi.categories.createCategory.mockResolvedValue({
        data: {
          category: { ...createdCategory, goal_type: 'NEED', goal_target: 45000 },
          server_knowledge: 102,
        },
      });

      const result = await CreateCategoryTool.execute(
        {
          budgetId: 'test-budget-id',
          categoryGroupId: 'group-1',
          name: 'Gym Membership',
          goalTarget: 45,
        },
        mockApi as any
      );

      expect(mockApi.categories.createCategory).toHaveBeenCalledWith(
        'test-budget-id',
        { category: { name: 'Gym Membership', category_group_id: 'group-1', goal_target: 45000 } }
      );

      const response = JSON.parse(result.content[0].text);
      expect(response.category.goal_target).toBe('45.00');
    });

    it('passes the note through', async () => {
      mockApi.categories.createCategory.mockResolvedValue({
        data: { category: { ...createdCategory, note: 'renews in January' }, server_knowledge: 103 },
      });

      await CreateCategoryTool.execute(
        {
          budgetId: 'test-budget-id',
          categoryGroupId: 'group-1',
          name: 'Gym Membership',
          note: 'renews in January',
        },
        mockApi as any
      );

      expect(mockApi.categories.createCategory).toHaveBeenCalledWith(
        'test-budget-id',
        { category: { name: 'Gym Membership', category_group_id: 'group-1', note: 'renews in January' } }
      );
    });

    it('uses YNAB_BUDGET_ID when budgetId is not provided', async () => {
      mockApi.categories.createCategory.mockResolvedValue({
        data: { category: createdCategory, server_knowledge: 104 },
      });

      await CreateCategoryTool.execute(
        {
          categoryGroupId: 'group-1',
          name: 'Gym Membership',
        },
        mockApi as any
      );

      expect(mockApi.categories.createCategory).toHaveBeenCalledWith(
        'test-budget-id',
        expect.any(Object)
      );
    });

    it('returns an error without calling the API when no budget ID is available', async () => {
      delete process.env.YNAB_BUDGET_ID;

      const result = await CreateCategoryTool.execute(
        {
          categoryGroupId: 'group-1',
          name: 'Gym Membership',
        },
        mockApi as any
      );

      expect(mockApi.categories.createCategory).not.toHaveBeenCalled();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toContain('No budget ID provided');
    });

    it('surfaces the YNAB error detail when the API rejects the request', async () => {
      mockApi.categories.createCategory.mockRejectedValue({
        error: { id: '404.2', name: 'resource_not_found', detail: 'Category group not found' },
      });

      const result = await CreateCategoryTool.execute(
        {
          budgetId: 'test-budget-id',
          categoryGroupId: 'missing-group',
          name: 'Gym Membership',
        },
        mockApi as any
      );

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe('Category group not found');
    });

    it('returns an error when the response carries no category', async () => {
      mockApi.categories.createCategory.mockResolvedValue({
        data: { category: null, server_knowledge: 105 },
      });

      const result = await CreateCategoryTool.execute(
        {
          budgetId: 'test-budget-id',
          categoryGroupId: 'group-1',
          name: 'Gym Membership',
        },
        mockApi as any
      );

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toContain('Failed to create category');
    });
  });

  describe('input schema', () => {
    const schema = z.object(CreateCategoryTool.inputSchema);

    it('requires a name and a category group', () => {
      expect(schema.safeParse({}).success).toBe(false);
      expect(schema.safeParse({ name: 'Gym Membership' }).success).toBe(false);
      expect(schema.safeParse({ categoryGroupId: 'group-1' }).success).toBe(false);
      expect(schema.safeParse({ name: 'Gym Membership', categoryGroupId: 'group-1' }).success).toBe(true);
    });

    it('rejects a blank name', () => {
      expect(schema.safeParse({ name: '', categoryGroupId: 'group-1' }).success).toBe(false);
      expect(schema.safeParse({ name: '   ', categoryGroupId: 'group-1' }).success).toBe(false);
    });
  });

  describe('tool configuration', () => {
    it('is registered under the ynab_ prefix like the other tools', () => {
      expect(CreateCategoryTool.name).toBe('ynab_create_category');
    });
  });
});
