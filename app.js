import 'dotenv/config';
import express from 'express';
import {
  InteractionType,
  InteractionResponseType,
} from 'discord-interactions';
import { VerifyDiscordRequest, parseTime, convertHoursMinutesToUTC } from './utils.js';
import generateTimestampMessage from './timestamp.js';
import { parse } from 'date-format-parse';

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// Parse request body and verifies incoming requests using discord-interactions package
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));
app.get('/', async function(_, res) {
  return res.send('IM ALIVE. STOP POKING ME.');
});
/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
app.post('/interactions', async function (req, res) {
  // Interaction type and data
  const { type, data } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    console.log(data);
    const { name, options } = data;
    switch(name){
        case 'timestamp':
          console.log("matched on timestamp responding with message to only the user");
          return handleTimestampCommand(res, options);
        default:
            console.log(`no match on interaction ${name}`);
            return null;
    }
  }
});

function generateFlags(onlyShowToCreator){
  if(onlyShowToCreator){
    return 1 << 6;
  }
}
// Send a message into the channel where command was triggered from
function respondWithMessage(res, message, onlyShowToCreator){
    return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: message,
            flags: generateFlags(onlyShowToCreator)
        },
    });
}
function handleTimestampCommand(res, commandOptions){
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
  return respondWithMessage(res, message, true);
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
    return generateTimestampMessage(parsedDate.getTime()/ 1000, type.value ?? 'R');
}
function handleRelativeTimestampCommand(options){
  const {hours, minutes} = parseTime(options[0].value);
  if(!hours && !minutes){
    return 'Your time could not be parsed. This is YOUR fault >:( Try again in the format: "in 9 hours 2 minutes" or "in 9h 2m"';
  }
  const timeUtc = convertHoursMinutesToUTC(hours, minutes);
  return generateTimestampMessage(timeUtc);
}

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
