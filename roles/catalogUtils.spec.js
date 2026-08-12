import {
    toColorHex,
    hexToInt,
    slugify,
    computeRoleName,
    generateUniqueCustomIdFrom,
    resolveFilterCategoryNames,
    paginateAchievementDefs,
    UNGROUPED_FILTER_ID,
} from './catalogUtils.js';

describe('catalogUtils', function () {
    describe('toColorHex', function () {
        it('formats an integer as #rrggbb with zero padding', function () {
            expect(toColorHex(0)).toBe('#000000');
            expect(toColorHex(0xbf8ddc)).toBe('#bf8ddc');
            expect(toColorHex(0xad4110)).toBe('#ad4110');
            expect(toColorHex(255)).toBe('#0000ff');
        });
    });

    describe('hexToInt', function () {
        it('parses #rrggbb and bare rrggbb into an integer', function () {
            expect(hexToInt('#ad4110')).toBe(0xad4110);
            expect(hexToInt('bf8ddc')).toBe(0xbf8ddc);
            expect(hexToInt('#000000')).toBe(0);
        });
        it('round-trips with toColorHex', function () {
            const values = [0, 0xbf8ddc, 0xad4110, 0xffffff, 0x123456];
            values.forEach((v) => expect(hexToInt(toColorHex(v))).toBe(v));
        });
    });

    describe('slugify', function () {
        it('lowercases and strips non-alphanumerics', function () {
            expect(slugify('Speed Demon')).toBe('speeddemon');
            expect(slugify("Tyria's Next Top Model")).toBe('tyriasnexttopmodel');
            expect(slugify('Master Scribe')).toBe('masterscribe');
        });
    });

    describe('computeRoleName', function () {
        it('joins short_name and description for achievement/crafting', function () {
            expect(computeRoleName('achievement', 'Speed Demon', 'Won the race')).toBe('Speed Demon - Won the race');
            expect(computeRoleName('crafting', 'Master Scribe', 'Reached max level on Scribe')).toBe('Master Scribe - Reached max level on Scribe');
        });
        it('uses the bare short_name for professions', function () {
            expect(computeRoleName('profession', 'Necromancer Enjoyer', '')).toBe('Necromancer Enjoyer');
        });
    });

    describe('generateUniqueCustomIdFrom', function () {
        it('returns the base slug when unused', function () {
            expect(generateUniqueCustomIdFrom('Speed Demon', [])).toBe('speeddemon');
            expect(generateUniqueCustomIdFrom('Speed Demon', new Set(['other']))).toBe('speeddemon');
        });
        it('appends the first free suffix on collision', function () {
            expect(generateUniqueCustomIdFrom('Speed Demon', ['speeddemon'])).toBe('speeddemon2');
            expect(generateUniqueCustomIdFrom('Speed Demon', ['speeddemon', 'speeddemon2'])).toBe('speeddemon3');
        });
        it('accepts an array or a Set', function () {
            expect(generateUniqueCustomIdFrom('Wild Card', new Set(['wildcard']))).toBe('wildcard2');
        });
    });

    describe('resolveFilterCategoryNames', function () {
        // Shape mirrors buildGamesWithCategories output: real games + an
        // Ungrouped entry whose id is null.
        const games = [
            {
                id: 'g1',
                name: 'Guild Wars 2',
                categories: [{ name: 'Raids' }, { name: 'Fractals' }],
            },
            {
                id: 'g2',
                name: 'World of Warcraft',
                categories: [{ name: 'Mythic+' }],
            },
            {
                id: null,
                name: 'Ungrouped',
                categories: [{ name: 'Orphan' }],
            },
        ];

        it('returns [category] for a direct category filter (taking precedence)', function () {
            expect(resolveFilterCategoryNames(games, { category: 'Raids' })).toEqual(['Raids']);
            // category wins even when a gameId is also present
            expect(resolveFilterCategoryNames(games, { gameId: 'g2', category: 'Raids' })).toEqual(['Raids']);
        });

        it('maps a real gameId to that game\'s category names', function () {
            expect(resolveFilterCategoryNames(games, { gameId: 'g1' })).toEqual(['Raids', 'Fractals']);
            expect(resolveFilterCategoryNames(games, { gameId: 'g2' })).toEqual(['Mythic+']);
        });

        it('maps the __ungrouped__ sentinel to the null-id entry\'s categories', function () {
            expect(resolveFilterCategoryNames(games, { gameId: UNGROUPED_FILTER_ID })).toEqual(['Orphan']);
            expect(UNGROUPED_FILTER_ID).toBe('__ungrouped__');
        });

        it('returns [] for an unknown gameId (empty result, not "all")', function () {
            expect(resolveFilterCategoryNames(games, { gameId: 'nope' })).toEqual([]);
        });

        it('returns null when no filter is active', function () {
            expect(resolveFilterCategoryNames(games, {})).toBeNull();
            expect(resolveFilterCategoryNames(games, { gameId: '', category: '' })).toBeNull();
            expect(resolveFilterCategoryNames(games, undefined)).toBeNull();
        });
    });

    describe('paginateAchievementDefs', function () {
        // 5 achievement defs across two categories.
        const defs = [
            { short_name: 'a1', category: 'Raids' },
            { short_name: 'a2', category: 'Raids' },
            { short_name: 'a3', category: 'Fractals' },
            { short_name: 'a4', category: 'Raids' },
            { short_name: 'a5', category: 'Fractals' },
        ];

        it('paginates the full set when no categoryNames filter is given', function () {
            const { items, pagination } = paginateAchievementDefs(defs, 1, 2);
            expect(pagination).toEqual({ page: 1, pageSize: 2, total: 5, totalPages: 3 });
            expect(items.map((d) => d.short_name)).toEqual(['a1', 'a2']);
        });

        it('filters BEFORE computing total/totalPages/slice', function () {
            const { items, pagination } = paginateAchievementDefs(defs, 1, 2, { categoryNames: ['Raids'] });
            // 3 Raids defs -> total 3, 2 pages at pageSize 2
            expect(pagination).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
            expect(items.map((d) => d.short_name)).toEqual(['a1', 'a2']);
        });

        it('returns the correct filtered slice for a later page', function () {
            const { items, pagination } = paginateAchievementDefs(defs, 2, 2, { categoryNames: ['Raids'] });
            expect(pagination.page).toBe(2);
            expect(items.map((d) => d.short_name)).toEqual(['a4']);
        });

        it('clamps a page beyond the filtered range back to totalPages', function () {
            const { items, pagination } = paginateAchievementDefs(defs, 99, 2, { categoryNames: ['Fractals'] });
            // 2 Fractals defs -> total 2, 1 page
            expect(pagination.total).toBe(2);
            expect(pagination.totalPages).toBe(1);
            expect(pagination.page).toBe(1);
            expect(items.map((d) => d.short_name)).toEqual(['a3', 'a5']);
        });

        it('accepts categoryNames as a Set', function () {
            const { pagination } = paginateAchievementDefs(defs, 1, 10, { categoryNames: new Set(['Raids', 'Fractals']) });
            expect(pagination.total).toBe(5);
        });

        it('yields total 0 and one empty page for a category with no matches', function () {
            const { items, pagination } = paginateAchievementDefs(defs, 1, 2, { categoryNames: ['Nope'] });
            expect(pagination).toEqual({ page: 1, pageSize: 2, total: 0, totalPages: 1 });
            expect(items).toEqual([]);
        });
    });
});
