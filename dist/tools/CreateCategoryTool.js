import { z } from "zod";
import { getErrorMessage } from "./errorUtils.js";
export const name = "ynab_create_category";
export const description = "Creates a new category in an existing category group. Use ynab_list_categories to find the group ID.";
export const inputSchema = {
    budgetId: z.string().optional().describe("The ID of the budget (optional, defaults to YNAB_BUDGET_ID environment variable)"),
    categoryGroupId: z.string().describe("The ID of the category group to create the category in"),
    name: z.string().trim().min(1).describe("Name for the new category (e.g. 'Gym Membership')"),
    note: z.string().optional().describe("Note for the category"),
    goalTarget: z.number().optional().describe("Goal target amount in euros (e.g. 45.00). Creates a monthly 'Needed for Spending' goal with this target."),
};
function getBudgetId(inputBudgetId) {
    const budgetId = inputBudgetId || process.env.YNAB_BUDGET_ID || "";
    if (!budgetId) {
        throw new Error("No budget ID provided. Please provide a budget ID or set the YNAB_BUDGET_ID environment variable.");
    }
    return budgetId;
}
export async function execute(input, api) {
    try {
        const budgetId = getBudgetId(input.budgetId);
        const categoryData = {
            name: input.name,
            category_group_id: input.categoryGroupId,
        };
        if (input.note !== undefined)
            categoryData.note = input.note;
        if (input.goalTarget !== undefined)
            categoryData.goal_target = Math.round(input.goalTarget * 1000);
        const response = await api.categories.createCategory(budgetId, { category: categoryData });
        if (!response.data.category) {
            throw new Error("Failed to create category - no category data returned");
        }
        const category = response.data.category;
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: true,
                        category: {
                            id: category.id,
                            name: category.name,
                            category_group_id: category.category_group_id,
                            note: category.note || null,
                            goal_type: category.goal_type || null,
                            goal_target: category.goal_target ? (category.goal_target / 1000).toFixed(2) : null,
                        },
                        message: `Successfully created category '${category.name}'`,
                    }, null, 2),
                }],
        };
    }
    catch (error) {
        console.error("Error creating category:", error);
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: false,
                        error: getErrorMessage(error),
                    }, null, 2),
                }],
        };
    }
}
