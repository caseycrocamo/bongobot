import 'dotenv/config';
import express from 'express';
import { InteractionType } from 'discord-interactions';
import { VerifyDiscordRequest } from './discordclient.js';
import { achievement_name_dropdown, choose_achievement, choose_crafting, choose_profession, profile_choice_dropdown, profile_name_dropdown, remove_all } from './customids.js';
import { handleTimestampCommand } from './timezones/timezonehandler.js'; 
import { handleProfileCommand, handleAssignAchievement, handleRemoveRole, handleProfileUpdate, respondWithAchievementChoices, handleGrantAchievementCommand, handleSetProfileCommand, handleSetProfile, respondWithProfessionChoices, respondWithCraftingChoices  } from './roles/profilehandler.js';
import { ackInteraction } from './discordresponsehelper.js';
import { handleAchievementsCommand } from './roles/achievementHandler.js';

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
    const { name, options, target_id } = data;
    switch(name){
        case 'timestamp':
          console.log("matched on timestamp responding with message to only the user");
          return handleTimestampCommand(res, options);
        case 'profile':
          console.log('matched on profile command. responding with a message to allow the user to modify their active role.')
          return handleProfileCommand(res);
        case 'achievements':
          console.log('matched on achievements command.')
          return await handleAchievementsCommand(res, member.user.id, guild_id, options);
        case 'Grant Achievement':
          console.log('matched on grant achievmement command.')
          return handleGrantAchievementCommand(res, member, target_id);
        case 'Set Profile':
          console.log('matched on set profile command.')
          return handleSetProfileCommand(res, member, target_id);
        default:
            console.log(`no match on interaction ${name}`);
            return null;
    }
  }
  if (type === InteractionType.MESSAGE_COMPONENT) {
    console.log('interaction matched on Message Type. responding based on the custom_id...');
    const {custom_id} = data;
    switch(custom_id){
      case choose_achievement:
        return respondWithAchievementChoices(res, member.user.id, guild_id);
      case choose_profession:
        return respondWithProfessionChoices(res);
      case choose_crafting:
        return respondWithCraftingChoices(res);
      case achievement_name_dropdown:
        return await handleAssignAchievement(res, member, guild_id, data.values[0]);
      case profile_name_dropdown:
        return await handleSetProfile(res, member, guild_id, data.values[0]);
      case profile_choice_dropdown:
        return await handleProfileUpdate(res, member, guild_id, data.values[0]);
      case remove_all:
        return await handleRemoveRole(res, member, guild_id);
      default: 
        return await handleProfileUpdate(res, member, guild_id, data.custom_id);
    }
  }
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
