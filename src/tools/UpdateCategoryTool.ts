import { z } from "zod";
import * as ynab from "ynab";
import { getErrorMessage } from "./errorUtils.js";

export const name = "ynab_update_category";
export const description = "Updates a category's name, note, or goal target. Use this to rename categories, add emoji prefixes, or change savings goal amounts.";
export const inputSchema = {
  budgetId: z.string().optional().describe("The ID of the budget (optional, defaults to YNAB_BUDGET_ID environment variable)"),
  categoryId: z.string().describe("The ID of the category to update"),
  name: z.string().optional().describe("New name for the category (e.g. '🛞 Tyres')"),
  note: z.string().optional().describe("Note for the category"),
  goalTarget: z.number().optional().describe("Goal target amount in euros (e.g. 960.00). Sets the savings goal target."),
  categoryGroupId: z.string().optional().describe("Move category to a different group by providing the group ID"),
};

interface UpdateCategoryInput {
  budgetId?: string;
  categoryId: string;
  name?: string;
  note?: string;
  goalTarget?: number;
  categoryGroupId?: string;
}

function getBudgetId(inputBudgetId?: string): string {
  const budgetId = inputBudgetId || process.env.YNAB_BUDGET_ID || "";
  if (!budgetId) {
    throw new Error("No budget ID provided. Please provide a budget ID or set the YNAB_BUDGET_ID environment variable.");
  }
  return budgetId;
}

export async function execute(input: UpdateCategoryInput, api: ynab.API) {
  try {
    const budgetId = getBudgetId(input.budgetId);

    const categoryData: ynab.SaveCategory = {};
    if (input.name !== undefined) categoryData.name = input.name;
    if (input.note !== undefined) categoryData.note = input.note;
    if (input.goalTarget !== undefined) categoryData.goal_target = Math.round(input.goalTarget * 1000);
    if (input.categoryGroupId !== undefined) categoryData.category_group_id = input.categoryGroupId;

    if (Object.keys(categoryData).length === 0) {
      throw new Error("No fields to update. Provide at least one of: name, note, goalTarget, categoryGroupId.");
    }

    const response = await api.categories.updateCategory(
      budgetId,
      input.categoryId,
      { category: categoryData },
    );

    if (!response.data.category) {
      throw new Error("Failed to update category - no category data returned");
    }

    const category = response.data.category;

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          success: true,
          category: {
            id: category.id,
            name: category.name,
            note: category.note || null,
            goal_type: category.goal_type || null,
            goal_target: category.goal_target ? (category.goal_target / 1000).toFixed(2) : null,
          },
          message: `Successfully updated category '${category.name}'`,
        }, null, 2),
      }],
    };
  } catch (error) {
    console.error("Error updating category:", error);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          success: false,
          error: getErrorMessage(error),
        }, null, 2),
      }],
    };
  }
}
