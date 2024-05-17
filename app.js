import 'dotenv/config';
import express from 'express';
import {
  InteractionType,
  InteractionResponseType,
} from 'discord-interactions';
import { VerifyDiscordRequest, parseTime, convertHoursMinutesToUTC } from './utils.js';
import generateTimestampMessage from './timestamp.js';
import setUsersActiveRole from './roles.js';
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
  const { type, data, member, guild_id } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return ackInteraction(res);
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
        case 'profile':
          console.log('matched on profile command. responding with a message to allow the user to choose a profession to apply to their roles.')
          return handleProfileCommand(res);
        default:
            console.log(`no match on interaction ${name}`);
            return null;
    }
  }
  if (type === InteractionType.MESSAGE_COMPONENT) {
    console.log('interaction matched on Message Type. attempting to set user role...');
    await setUsersActiveRole(member, guild_id, data.custom_id);
    //ponging on the interaction doesn't work here. Need to figure out some way to respond to the interaction so that it knows it is completed.
  }
});

function generateFlags(onlyShowToCreator){
  if(onlyShowToCreator){
    return 1 << 6;
  }
}
function ackInteraction(res){
  return res.send({ type: InteractionResponseType.PONG });
}
// Send a message into the channel where command was triggered from
function respondWithTextMessage(res, message, onlyShowToCreator){
    return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: message,
            flags: generateFlags(onlyShowToCreator)
        },
    });
}
function respondWithComponentMessage(res, message, components, onlyShowToCreator){
    return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: message,
            components,
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
  return respondWithTextMessage(res, message, true);
}
function handleProfileCommand(res){
  const message = 'Show off your favorite profession with a shiny new name color and profession icon! Pick a profession:';
  const components = [
    {
      type: 1,
      components: [
          {
              type: 2,
              label: "Elementalist",
              style: 1,
              custom_id: "elementalistenjoyer"
          },
          {
              type: 2,
              label: "Mesmer",
              style: 1,
              custom_id: "mesmerenjoyer"
          },
          {
              type: 2,
              label: "Necromancer",
              style: 1,
              custom_id: "necromancerenjoyer"
          },
      ]
    },
    {
      type: 1,
      components: [
          {
              type: 2,
              label: "Engineer",
              style: 1,
              custom_id: "engineerenjoyer"
          },
          {
              type: 2,
              label: "Ranger",
              style: 1,
              custom_id: "rangerenjoyer"
          },
          {
              type: 2,
              label: "Thief",
              style: 1,
              custom_id: "thiefenjoyer"
          },
      ]
    },
    {
      type: 1,
      components: [
          {
              type: 2,
              label: "Guardian",
              style: 1,
              custom_id: "guardianenjoyer"
          },
          {
              type: 2,
              label: "Revenant",
              style: 1,
              custom_id: "revenantenjoyer"
          },
          {
              type: 2,
              label: "Warrior",
              style: 1,
              custom_id: "warriorenjoyer"
          },
      ]
    }
  ];
  return respondWithComponentMessage(res, message, components, true);
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
