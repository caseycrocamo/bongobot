import { buildGamesWithCategories, countAchievementCategories } from './catalogUtils.js';

// These pure helpers back the DB-loading getGamesWithCategories() (effectiveCatalog.js)
// and getAchievementCategoryCounts() (catalog.js); testing them exercises the
// game->category grouping, the "Ungrouped" bucket, and the count totals without a DB.

describe('countAchievementCategories', function () {
    it('counts defs by category name across all defs', function () {
        const defs = [
            { category: 'Raids' },
            { category: 'Raids' },
            { category: 'Fractals' },
            { category: 'Raids' },
        ];
        expect(countAchievementCategories(defs)).toEqual({ Raids: 3, Fractals: 1 });
    });

    it('ignores defs with a null/empty category', function () {
        const defs = [
            { category: 'Raids' },
            { category: null },
            { category: '' },
            { category: undefined },
        ];
        expect(countAchievementCategories(defs)).toEqual({ Raids: 1 });
    });

    it('returns an empty object for no defs', function () {
        expect(countAchievementCategories([])).toEqual({});
        expect(countAchievementCategories(undefined)).toEqual({});
    });
});

describe('buildGamesWithCategories', function () {
    // ObjectId-like ids: String(id) coercion is what the grouping relies on.
    const gw2 = { _id: { toString: () => 'g1' }, name: 'Guild Wars 2', slug: 'guildwars2' };
    const wow = { _id: { toString: () => 'g2' }, name: 'World of Warcraft', slug: 'worldofwarcraft' };

    it('groups categories under their game by String(gameId) === String(_id)', function () {
        const games = [gw2, wow];
        const categories = [
            { name: 'Raids', slug: 'raids', gameId: { toString: () => 'g1' }, order: 0 },
            { name: 'Fractals', slug: 'fractals', gameId: { toString: () => 'g1' }, order: 1 },
            { name: 'Mythic+', slug: 'mythic', gameId: { toString: () => 'g2' }, order: 2 },
        ];
        const counts = { Raids: 3, Fractals: 1, 'Mythic+': 5 };

        const result = buildGamesWithCategories(games, categories, counts);

        expect(result).toEqual([
            {
                id: 'g1',
                name: 'Guild Wars 2',
                slug: 'guildwars2',
                count: 4,
                categories: [
                    { name: 'Raids', slug: 'raids', count: 3 },
                    { name: 'Fractals', slug: 'fractals', count: 1 },
                ],
            },
            {
                id: 'g2',
                name: 'World of Warcraft',
                slug: 'worldofwarcraft',
                count: 5,
                categories: [{ name: 'Mythic+', slug: 'mythic', count: 5 }],
            },
        ]);
    });

    it('collects categories whose gameId matches no game into an "Ungrouped" bucket', function () {
        const games = [gw2];
        const categories = [
            { name: 'Raids', slug: 'raids', gameId: { toString: () => 'g1' }, order: 0 },
            { name: 'Orphan', slug: 'orphan', gameId: { toString: () => 'ghost' }, order: 1 },
        ];
        const counts = { Raids: 2, Orphan: 7 };

        const result = buildGamesWithCategories(games, categories, counts);

        expect(result.length).toBe(2);
        expect(result[1]).toEqual({
            id: null,
            name: 'Ungrouped',
            slug: 'ungrouped',
            count: 7,
            categories: [{ name: 'Orphan', slug: 'orphan', count: 7 }],
        });
    });

    it('omits the Ungrouped bucket when every category matches a game', function () {
        const games = [gw2];
        const categories = [
            { name: 'Raids', slug: 'raids', gameId: { toString: () => 'g1' }, order: 0 },
        ];
        const result = buildGamesWithCategories(games, categories, { Raids: 1 });
        expect(result.length).toBe(1);
        expect(result[0].id).toBe('g1');
    });

    it('defaults missing counts to 0 (zero-count categories still appear)', function () {
        const games = [gw2];
        const categories = [
            { name: 'Raids', slug: 'raids', gameId: { toString: () => 'g1' }, order: 0 },
            { name: 'Empty', slug: 'empty', gameId: { toString: () => 'g1' }, order: 1 },
        ];
        const result = buildGamesWithCategories(games, categories, { Raids: 2 });
        expect(result[0].count).toBe(2);
        expect(result[0].categories).toEqual([
            { name: 'Raids', slug: 'raids', count: 2 },
            { name: 'Empty', slug: 'empty', count: 0 },
        ]);
    });

    it('accepts counts as a Map as well as a plain object', function () {
        const games = [gw2];
        const categories = [
            { name: 'Raids', slug: 'raids', gameId: { toString: () => 'g1' }, order: 0 },
        ];
        const result = buildGamesWithCategories(games, categories, new Map([['Raids', 4]]));
        expect(result[0].categories[0].count).toBe(4);
    });

    it('handles empty inputs', function () {
        expect(buildGamesWithCategories([], [], {})).toEqual([]);
        expect(buildGamesWithCategories(undefined, undefined, undefined)).toEqual([]);
    });
});
