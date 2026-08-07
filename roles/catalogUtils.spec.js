import { toColorHex, hexToInt, slugify, computeRoleName, generateUniqueCustomIdFrom } from './catalogUtils.js';

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
});
