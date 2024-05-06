function CreateUnixTimeStamp(utcTime, type = 'R'){
    return `<t:${utcTime}:${type}>`;
}
export default function generateTimestampMessage(utcTime, type = 'R'){
    const unixTimestamp = CreateUnixTimeStamp(utcTime, type);
    return `Preview: ${unixTimestamp}\n if it looks right, paste this into your message:\`${unixTimestamp}\``;
}