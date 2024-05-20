import { parseTime } from '../timestamp.js';
describe("parseTime", function() {
    const testCases = [
        {
            input: 'in 9 hours',
            expectedHours: 9,
            expectedMinutes: 0
        },
        {
            input: 'in 9h',
            expectedHours: 9,
            expectedMinutes: 0
        },
        {
            input: 'in 9 hours 30 minutes',
            expectedHours: 9,
            expectedMinutes: 30
        },
        {
            input: 'in 9 minutes',
            expectedHours: 0,
            expectedMinutes: 9
        },
        {
            input: '9 hours',
            expectedHours: 9,
            expectedMinutes: 0
        },
        {
            input: '9 hours 40 minutes',
            expectedHours: 9,
            expectedMinutes: 40
        },
        {
            input: '9 hour 40 minute',
            expectedHours: 9,
            expectedMinutes: 40
        },
        {
            input: '90 hour 40 minute',
            expectedHours: 90,
            expectedMinutes: 40
        },
        {
            input: '940 minutes',
            expectedHours: 0,
            expectedMinutes: 940
        },
        {
            input: '20m',
            expectedHours: 0,
            expectedMinutes: 20
        },
        {
            input: '20h',
            expectedHours: 20,
            expectedMinutes: 0
        },
        {
            input: 'in 20m',
            expectedHours: 0,
            expectedMinutes: 20
        },
        {
            input: 'in 20h',
            expectedHours: 20,
            expectedMinutes: 0
        },
        {
            input: '20h 20m',
            expectedHours: 20,
            expectedMinutes: 20
        },
        {
            input: 'in 20h 20m',
            expectedHours: 20,
            expectedMinutes: 20
        },
        {
            input: 'this will not match',
            expectedHours: null,
            expectedMinutes: null
        },
    ];
    testCases.forEach(testCase => {
        describe(testCase.input, function() {
            const {input, expectedHours, expectedMinutes} = testCase;
            it('returns a valid, correct time', function() {
                const {hours, minutes} = parseTime(input);
                expect(hours).toBe(expectedHours);
                expect(minutes).toBe(expectedMinutes);
            });
        });
    });
});