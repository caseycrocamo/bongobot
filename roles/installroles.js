import { AddGuildRoles } from './roles.js';
import { ACHIEVEMENT_ROLES } from './achievementRoles.js';
import { PROFESSION_ROLES } from './professionRoles.js';
import { CRAFTING_ROLES } from './craftingRoles.js';
AddGuildRoles([...ACHIEVEMENT_ROLES, ...PROFESSION_ROLES, ...CRAFTING_ROLES ]);