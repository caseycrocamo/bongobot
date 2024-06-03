import 'dotenv/config';
import generateTimestampMessage, { parseTime, convertHoursMinutesToUTC } from './timestamp.js';
import { parse } from 'date-format-parse';
import { respondWithComponentMessage } from '../discordresponsehelper.js';

export function handleTimestampCommand(res, commandOptions){
  let message = '';
  const {name, options} = commandOptions[0];
  switch(name){
    case 'absolute':
        message = handleAbsoluteTimestampCommand(options);
        break;
    case 'relative':
        message = handleRelativeTimestampCommand(options);
        break;
    default:
        message = 'Oops, something went wrong. Please try again later.'
        break;
  }
  return respondWithComponentMessage(res, message, {onlyShowToCreator: true});
}
function handleAbsoluteTimestampCommand(options){
    const [date, time, timezone, type] = options;
    const dateString = `${date.value} ${time.value.toLowerCase()} ${timezone.value}`;
    console.log(dateString);
    const parsedDate = parse(dateString, 'M/D/YY H:mma ZZ');
    console.log(parsedDate);
    if(parsedDate == 'Invalid Date'){
        return 'Your input is as malformatted as your face. Fix it and try again.';
    }
    return generateTimestampMessage(parsedDate.getTime()/ 1000, type?.value ?? 'R');
}
function handleRelativeTimestampCommand(options){
  const {hours, minutes} = parseTime(options[0].value);
  if(!hours && !minutes){
    return 'Your time could not be parsed. This is YOUR fault >:( Try again in the format: "in 9 hours 2 minutes" or "in 9h 2m"';
  }
  const timeUtc = convertHoursMinutesToUTC(hours, minutes);
  return generateTimestampMessage(timeUtc);
}