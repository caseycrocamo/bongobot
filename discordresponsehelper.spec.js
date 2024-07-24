import {generateFlags} from "./discordresponsehelper.js"
describe("generateFlags", function() {
    const negativeTestCases = [
        {},
        undefined,
        null,
        false
    ];
    describe("negative test cases", function() {
        negativeTestCases.forEach(testCase => {
            it('returns null', function() {
                const actualFlags = generateFlags(testCase)
                expect(actualFlags).toBeNull();
            });
        });
    });
    describe('positive test cases', function() {
        it("returns 1 << 6 when true", function() {
            const actualFlags = generateFlags(true)
            expect(actualFlags).toBe(1 << 6);
        });
    });
});