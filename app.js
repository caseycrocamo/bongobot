import 'dotenv/config';
import express from 'express';
import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
  ButtonStyleTypes,
  TextStyleTypes,
} from 'discord-interactions';
import { VerifyDiscordRequest, parseTime, convertHoursMinutesToUTC } from './utils.js';
import generateTimestampMessage from './timestamp.js';

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
function handleTimestampCommand(res, options){
  let message = '';
  const {hours, minutes} = parseTime(options[0].value);
  const timeUtc = convertHoursMinutesToUTC(hours, minutes);
  if(timeUtc){
    message = generateTimestampMessage(timeUtc);
  }
  else{
    message = 'Your time could not be parsed. This is YOUR fault >:( Try again in the format: "in 9 hours 2 minutes" or "in 9h 2m"';
  }

  return respondWithMessage(res, message, true);
}

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
