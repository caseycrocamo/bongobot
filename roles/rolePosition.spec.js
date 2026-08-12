import { computeTargetPositionBelowAnchors } from './roles.js';

describe('computeTargetPositionBelowAnchors', function () {
    const roles = [
        { id: 'everyone', position: 0 },
        { id: 'admin', position: 8 },
        { id: 'mod', position: 5 },
        { id: 'bot', position: 9 },
    ];

    it('targets the anchor slot when present (lands directly below it)', function () {
        const result = computeTargetPositionBelowAnchors(roles, ['admin']);
        expect(result).toEqual({ position: 8, source: 'anchor' });
    });

    it('uses the lowest-positioned anchor when multiple are present', function () {
        const result = computeTargetPositionBelowAnchors(roles, ['admin', 'mod']);
        expect(result).toEqual({ position: 5, source: 'anchor' });
    });

    it('falls back to below the highest role when no anchors configured', function () {
        const result = computeTargetPositionBelowAnchors(roles, []);
        expect(result).toEqual({ position: 8, source: 'default' });
    });

    it('falls back to default when configured anchors are absent from the guild', function () {
        const result = computeTargetPositionBelowAnchors(roles, ['missing']);
        expect(result).toEqual({ position: 8, source: 'default' });
    });

    it('never returns a position below 1', function () {
        const twoRoles = [
            { id: 'everyone', position: 0 },
            { id: 'admin', position: 1 },
        ];
        expect(computeTargetPositionBelowAnchors(twoRoles, ['admin']).position).toBe(1);
    });

    it('guards against a non-array currentRoles', function () {
        const result = computeTargetPositionBelowAnchors(undefined, ['admin']);
        expect(result).toEqual({ position: 1, source: 'default' });
    });
});
