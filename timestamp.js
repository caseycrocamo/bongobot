function CreateUnixTimeStamp(utcTime, type = 'R'){
    return `<t:${utcTime}:${type}>`;
}
export default function generateTimestampMessage(utcTime, type = 'R'){
    const unixTimestamp = CreateUnixTimeStamp(utcTime, type);
    return `Preview: ${unixTimestamp}\n if it looks right, paste this into your message:\`${unixTimestamp}\``;
}
export function parseTime(inputString) {
    const matchHours = inputString.match(/(in\s)?(\d+)?(\s?(?:hour|hours|h|hs)\s?)?/);
    const matchMinutes = inputString.match(/(?:in\s?)?(?:\d+\s?(?:hour|hours|h|hs)\s)?(\d+)?(\s?(?:minute|minutes|min|mins|m)\s?)?/);
    console.log(matchMinutes);
    if((!matchHours && !matchMinutes) || (!matchHours[2] && !matchMinutes[1])){
        console.log(`could not parse time input: ${inputString}`);
        return {hours: null, minutes: null};
    }
    const hours = (matchHours[2] && matchHours[3]) ? parseInt(matchHours[2]) : 0;
    const minutes = (matchMinutes[1] && matchMinutes[2]) ? parseInt(matchMinutes[1]) : 0;
    return {hours, minutes};
}
export function convertHoursMinutesToUTC(hours, minutes){
    const currentTime = new Date();
    const futureTime = new Date(currentTime.getTime() + (hours * 60 * 60 * 1000) + (minutes * 60 * 1000));
    return Math.floor(futureTime.getTime() / 1000);
}