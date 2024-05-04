function CreateUnixTimeStamp(utcTime){
    return `<t:${utcTime}:R>`;
}
export default function generateTimestampMessage(utcTime){
    return `Preview: ${CreateUnixTimeStamp(utcTime)}\n if it looks right, paste this into your message:\`${CreateUnixTimeStamp(utcTime)}\``;
}