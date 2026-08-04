import { ACHIEVEMENT_ROLES, ACHIEVEMENT_CATEGORIES } from "./achievementRoles.js";
import { CRAFTING_ROLES } from "./craftingRoles.js";
import { PROFESSION_ROLES } from "./professionRoles.js";

function toHexColor(color) {
    return '#' + color.toString(16).padStart(6, '0');
}

function normalizeAchievement(role) {
    return {
        short_name: role.short_name,
        name: role.name,
        description: role.description,
        custom_id: role.custom_id,
        category: role.category,
        color: toHexColor(role.color),
        mentionable: role.mentionable,
        icon: role.icon,
    };
}

export function getAchievementsPage(page, pageSize) {
    const total = ACHIEVEMENT_ROLES.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const clampedPage = Math.min(Math.max(page, 1), totalPages);
    const start = (clampedPage - 1) * pageSize;
    const items = ACHIEVEMENT_ROLES.slice(start, start + pageSize).map(normalizeAchievement);
    return {
        items,
        pagination: { page: clampedPage, pageSize, total, totalPages },
    };
}

export function getAchievementCategoryOrder() {
    return ACHIEVEMENT_CATEGORIES.map((category) => category.name);
}

export function rolesForFallback() {
    return [...ACHIEVEMENT_ROLES, ...CRAFTING_ROLES, ...PROFESSION_ROLES].map((role) => ({
        short_name: role.short_name ?? role.name,
        name: role.name,
        color: toHexColor(role.color),
        mentionable: role.mentionable,
    }));
}
