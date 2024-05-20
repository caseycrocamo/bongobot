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
export async function InstallGuildCommands(appId, guildId, commands) {
  // API endpoint to overwrite guild commands
  const guildEndpoint = `applications/${appId}/guilds/${guildId}/commands`;

  try {
    // This is calling the bulk overwrite endpoint: https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-global-application-commands
    await DiscordRequest(guildEndpoint, { method: 'PUT', body: commands });
  } catch (err) {
    console.error(err);
  }
}
export async function InstallGuildRole(guildId, role) {
  // API endpoint to add guild role
  const endpoint = `/guilds/${guildId}/roles`;

  try {
    const request = await DiscordRequest(endpoint, { method: 'POST', body: role });
    return await request.json();
  } catch (err) {
    return console.error(err);
  }
}
export async function ModifyGuildRolePosition(guildId, role) {
  // API endpoint to add guild role
  const endpoint = `/guilds/${guildId}/roles`;

  try {
    const request = await DiscordRequest(endpoint, { method: 'PATCH', body: role });
    return await request.json();
  } catch (err) {
    return console.error(err);
  }
}
export async function GetGuildRoles(guildId) {
  // API endpoint to add guild role
  const endpoint = `/guilds/${guildId}/roles`;

  try {
    console.log('getting roles from guild ', guildId);
    const request = await DiscordRequest(endpoint, { method: 'GET' });
    return await request.json();
  } catch (err) {
    return console.error(err);
  }
}
export async function ModifyMember(guildId, userId, member) {
  // API endpoint to add guild role
  const endpoint = `/guilds/${guildId}/members/${userId}`;

  try {
    const request = await DiscordRequest(endpoint, { method: 'PATCH', body: member });
    return await request.json();
  } catch (err) {
    return console.error(err);
  }
}