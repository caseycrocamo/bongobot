import 'dotenv/config';
import express from 'express';
import {
  InteractionType,
  InteractionResponseType,
} from 'discord-interactions';
import { VerifyDiscordRequest, parseTime, convertHoursMinutesToUTC } from './utils.js';
import generateTimestampMessage from './timestamp.js';
import setUsersActiveRole, { removeUsersCurrentRole } from './roles.js';
import { parse } from 'date-format-parse';
import { choose_achievement, choose_profession, elementalistenjoyer, engineerenjoyer, guardianenjoyer, mesmerenjoyer, necromancerenjoyer, rangerenjoyer, remove_all, revenantenjoyer, thiefenjoyer, warriorenjoyer, wildcard } from './customids.js';

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
          console.log('matched on profile command. responding with a message to allow the user to modify their active role.')
          return handleProfileCommand(res);
        default:
            console.log(`no match on interaction ${name}`);
            return null;
    }
  }
  if (type === InteractionType.MESSAGE_COMPONENT) {
    console.log('interaction matched on Message Type. responding based on the custom_id...');
    switch(data.custom_id){
      case choose_achievement:
        return respondWithAchievementChoices(res);
      case choose_profession:
        return respondWithProfessionChoices(res);
      case remove_all:
        return await handleRemoveRole(res, member, guild_id);
      default: 
        return await handleProfileUpdate(res, member, guild_id, data.custom_id);
    }
  }
});
async function handleRemoveRole(res, member, guild_id){
    try{
      const roleRemoved = await removeUsersCurrentRole(member, guild_id);
      const message = roleRemoved ? 'Successfully removed your active role.' : 'No role found to remove. If you believe this is an error contact a mod.';
      return respondWithUpdateMessage(res, message);
    } catch(err) {
      console.error(err);
      return respondWithUpdateMessage(res, 'Sorry, I was unable to update your role. Try again or contact a local mod.');
    }
}
async function handleProfileUpdate(res, member, guild_id, role){
    try{
      await setUsersActiveRole(member, guild_id, role);
      return respondWithUpdateMessage(res, 'Successfully updated your active role!');
    } catch {
      return respondWithUpdateMessage(res, 'Sorry, I was unable to update your role. Try again or contact a local mod.');
    }
}

async function respondWithAchievementChoices(res){
  const message = 'Which achievement would you like to show off? It will set the color of your name and your badge in this server.'
  const components = [
    {
      type: 1,
      components: [
          {
              type: 2,
              label: "Wildcard",
              style: 1,
              custom_id: wildcard
          },
      ]
    },
  ];
  return respondWithUpdateMessage(res, message, {components});
}

function generateFlags(onlyShowToCreator){
  if(onlyShowToCreator){
    return 1 << 6;
  }
}
function ackInteraction(res){
  return res.send({ type: InteractionResponseType.PONG });
}
function respondWithComponentMessage(res, message, options = {}){
  const {onlyShowToCreator, components} = options;
    return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: message,
            components,
            flags: generateFlags(onlyShowToCreator)
        },
    });
}
function respondWithUpdateMessage(res, message, options = {}) {
  const {onlyShowToCreator, components} = options;
    return res.send({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {
            content: message,
            components: components ?? [],
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
  return respondWithComponentMessage(res, message, {onlyShowToCreator: true});
}
function respondWithProfessionChoices(res){
  const message = 'Show off your favorite profession with a shiny new name color and profession icon! Pick a profession:';
  const components = [
    {
      type: 1,
      components: [
          {
              type: 2,
              label: "Elementalist",
              style: 1,
              custom_id: elementalistenjoyer
          },
          {
              type: 2,
              label: "Mesmer",
              style: 1,
              custom_id: mesmerenjoyer
          },
          {
              type: 2,
              label: "Necromancer",
              style: 1,
              custom_id: necromancerenjoyer
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
              custom_id: engineerenjoyer
          },
          {
              type: 2,
              label: "Ranger",
              style: 1,
              custom_id: rangerenjoyer
          },
          {
              type: 2,
              label: "Thief",
              style: 1,
              custom_id: thiefenjoyer
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
              custom_id: guardianenjoyer
          },
          {
              type: 2,
              label: "Revenant",
              style: 1,
              custom_id: revenantenjoyer
          },
          {
              type: 2,
              label: "Warrior",
              style: 1,
              custom_id: warriorenjoyer
          },
      ]
    }
  ];
  return respondWithUpdateMessage(res, message, {components, onlyShowToCreator: true});
}
function handleProfileCommand(res){
  const message = 'What would you like to do?';
  const components = [
    {
      type: 1,
      components: [
          {
              type: 2,
              label: "Remove Role",
              style: 1,
              custom_id: remove_all
          },
          {
              type: 2,
              label: "Choose a Profession",
              style: 1,
              custom_id: choose_profession
          },
          {
              type: 2,
              label: "Show off Achievements",
              style: 1,
              custom_id: choose_achievement
          },
      ]
    },
  ]
  return respondWithComponentMessage(res, message, {components, onlyShowToCreator: true});
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

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
