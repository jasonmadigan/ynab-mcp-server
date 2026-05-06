import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import * as ynab from 'ynab';
import * as UpdateCategoryTool from '../tools/UpdateCategoryTool';

vi.mock('ynab');

describe('UpdateCategoryTool', () => {
  let mockApi: {
    categories: {
      updateCategory: Mock;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockApi = {
      categories: {
        updateCategory: vi.fn(),
      },
    };

    (ynab.API as any).mockImplementation(() => mockApi);

    process.env.YNAB_API_TOKEN = 'test-token';
    process.env.YNAB_BUDGET_ID = 'test-budget-id';
  });

  describe('execute', () => {
    const mockCategoryResponse = {
      data: {
        category: {
          id: 'category-1',
          name: '🛞 Tyres',
          note: null,
          goal_type: 'NEED',
          goal_target: 960000,
        },
      },
    };

    it('should successfully update category name', async () => {
      mockApi.categories.updateCategory.mockResolvedValue(mockCategoryResponse);

      const result = await UpdateCategoryTool.execute(
        {
          budgetId: 'test-budget-id',
          categoryId: 'category-1',
          name: '🛞 Tyres',
        },
        mockApi as any
      );

      expect(mockApi.categories.updateCategory).toHaveBeenCalledWith(
        'test-budget-id',
        'category-1',
        { category: { name: '🛞 Tyres' } }
      );

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.category.name).toBe('🛞 Tyres');
    });

    it('should update goal target converting to milliunits', async () => {
      mockApi.categories.updateCategory.mockResolvedValue(mockCategoryResponse);

      await UpdateCategoryTool.execute(
        {
          budgetId: 'test-budget-id',
          categoryId: 'category-1',
          goalTarget: 960.00,
        },
        mockApi as any
      );

      expect(mockApi.categories.updateCategory).toHaveBeenCalledWith(
        'test-budget-id',
        'category-1',
        { category: { goal_target: 960000 } }
      );
    });

    it('should update multiple fields at once', async () => {
      mockApi.categories.updateCategory.mockResolvedValue(mockCategoryResponse);

      await UpdateCategoryTool.execute(
        {
          budgetId: 'test-budget-id',
          categoryId: 'category-1',
          name: '🛞 Tyres',
          goalTarget: 960.00,
          note: 'every ~21 months',
        },
        mockApi as any
      );

      expect(mockApi.categories.updateCategory).toHaveBeenCalledWith(
        'test-budget-id',
        'category-1',
        { category: { name: '🛞 Tyres', goal_target: 960000, note: 'every ~21 months' } }
      );
    });

    it('should use YNAB_BUDGET_ID from env when budgetId not provided', async () => {
      mockApi.categories.updateCategory.mockResolvedValue(mockCategoryResponse);

      await UpdateCategoryTool.execute(
        {
          categoryId: 'category-1',
          name: '🛞 Tyres',
        },
        mockApi as any
      );

      expect(mockApi.categories.updateCategory).toHaveBeenCalledWith(
        'test-budget-id',
        'category-1',
        expect.any(Object)
      );
    });

    it('should return error when no fields provided', async () => {
      const result = await UpdateCategoryTool.execute(
        {
          budgetId: 'test-budget-id',
          categoryId: 'category-1',
        },
        mockApi as any
      );

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toContain('No fields to update');
    });

    it('should return error when no budget ID available', async () => {
      delete process.env.YNAB_BUDGET_ID;

      const result = await UpdateCategoryTool.execute(
        {
          categoryId: 'category-1',
          name: 'Test',
        },
        mockApi as any
      );

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toContain('No budget ID provided');
    });

    it('should handle API error', async () => {
      mockApi.categories.updateCategory.mockRejectedValue(new Error('API Error'));

      const result = await UpdateCategoryTool.execute(
        {
          budgetId: 'test-budget-id',
          categoryId: 'category-1',
          name: 'Test',
        },
        mockApi as any
      );

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe('API Error');
    });

    it('should handle missing category in response', async () => {
      mockApi.categories.updateCategory.mockResolvedValue({
        data: { category: null },
      });

      const result = await UpdateCategoryTool.execute(
        {
          budgetId: 'test-budget-id',
          categoryId: 'category-1',
          name: 'Test',
        },
        mockApi as any
      );

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toContain('Failed to update category');
    });
  });

  describe('tool configuration', () => {
    it('should have correct name and description', () => {
      expect(UpdateCategoryTool.name).toBe('ynab_update_category');
      expect(UpdateCategoryTool.description).toContain('category');
    });

    it('should have required input schema fields', () => {
      expect(UpdateCategoryTool.inputSchema).toHaveProperty('budgetId');
      expect(UpdateCategoryTool.inputSchema).toHaveProperty('categoryId');
      expect(UpdateCategoryTool.inputSchema).toHaveProperty('name');
      expect(UpdateCategoryTool.inputSchema).toHaveProperty('goalTarget');
    });
  });
});
