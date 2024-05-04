import 'dotenv/config';
import fetch from 'node-fetch';
import { verifyKey } from 'discord-interactions';

export function VerifyDiscordRequest(clientKey) {
  return function (req, res, buf, encoding) {
    const signature = req.get('X-Signature-Ed25519');
    const timestamp = req.get('X-Signature-Timestamp');

    const isValidRequest = verifyKey(buf, signature, timestamp, clientKey);
    if (!isValidRequest) {
      res.status(401).send('Bad request signature');
      throw new Error('Bad request signature');
    }
  };
}

export async function DiscordRequest(endpoint, options) {
  // append endpoint to root API URL
  const url = 'https://discord.com/api/v10/' + endpoint;
  // Stringify payloads
  if (options.body) options.body = JSON.stringify(options.body);
  // Use node-fetch to make requests
  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': 'DiscordBot (https://github.com/discord/discord-example-app, 1.0.0)',
    },
    ...options
  });
  // throw API errors
  if (!res.ok) {
    const data = await res.json();
    console.log(res.status);
    throw new Error(JSON.stringify(data));
  }
  // return original response
  return res;
}

export async function InstallGlobalCommands(appId, commands) {
  // API endpoint to overwrite global commands
  const endpoint = `applications/${appId}/commands`;

  try {
    // This is calling the bulk overwrite endpoint: https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-global-application-commands
    await DiscordRequest(endpoint, { method: 'PUT', body: commands });
  } catch (err) {
    console.error(err);
  }
}
export async function InstallGuildCommands(appId, commands) {
  // API endpoint to overwrite global commands
  const guildId = '125485770659201025';
  const guildEndpoint = `applications/${appId}/guilds/${guildId}/commands`;

  try {
    // This is calling the bulk overwrite endpoint: https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-global-application-commands
    await DiscordRequest(guildEndpoint, { method: 'PUT', body: commands });
  } catch (err) {
    console.error(err);
  }
}
// Simple method that returns a random emoji from list
export function getRandomEmoji() {
  const emojiList = ['😭','😄','😌','🤓','😎','😤','🤖','😶‍🌫️','🌏','📸','💿','👋','🌊','✨'];
  return emojiList[Math.floor(Math.random() * emojiList.length)];
}

export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
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