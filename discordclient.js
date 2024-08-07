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
  const endpoint = `applications/${appId}/commands`;

  try {
    await DiscordRequest(endpoint, { method: 'PUT', body: commands });
  } catch (err) {
    console.error(err);
  }
}
export async function InstallGuildCommands(appId, guildId, commands) {
  const guildEndpoint = `applications/${appId}/guilds/${guildId}/commands`;

  try {
    await DiscordRequest(guildEndpoint, { method: 'PUT', body: commands });
  } catch (err) {
    console.error(err);
  }
}
export async function GetAllGuildCommands(appId, guildId) {
  const guildEndpoint = `applications/${appId}/guilds/${guildId}/commands`;

  try {
    const response = await DiscordRequest(guildEndpoint, { method: 'GET' });
    return await response.json();
  } catch (err) {
    console.error(err);
  }
}
export async function DeleteGuildCommand(appId, guildId, commandId) {
  const guildEndpoint = `applications/${appId}/guilds/${guildId}/commands/${commandId}`;

  try {
    await DiscordRequest(guildEndpoint, { method: 'DELETE' });
  } catch (err) {
    console.error(err);
  }
}
export async function InstallGuildRole(guildId, role) {
  const endpoint = `/guilds/${guildId}/roles`;

  try {
    const request = await DiscordRequest(endpoint, { method: 'POST', body: role });
    return await request.json();
  } catch (err) {
    return console.error(err);
  }
}
export async function ModifyGuildRolePosition(guildId, role) {
  const endpoint = `/guilds/${guildId}/roles`;

  try {
    const request = await DiscordRequest(endpoint, { method: 'PATCH', body: role });
    return await request.json();
  } catch (err) {
    return console.error(err);
  }
}
export async function GetGuildRoles(guildId) {
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
  const endpoint = `/guilds/${guildId}/members/${userId}`;

  try {
    const request = await DiscordRequest(endpoint, { method: 'PATCH', body: member });
    return await request.json();
  } catch (err) {
    return console.error(err);
  }
}
export async function GetMember(guildId, memberId) {
  const endpoint = `/guilds/${guildId}/members/${memberId}`;

  try {
    const request = await DiscordRequest(endpoint, { method: 'GET' });
    return await request.json();
  } catch (err) {
    return console.error(err);
  }
}
export async function CreateInteractionResponse(interaction, body) {
  const endpoint = `/interactions/${interaction.id}/${interaction.token}/callback`;

  try {
    const request = await DiscordRequest(endpoint, { method: 'POST', body });
    return await request.json();
  } catch (err) {
    return console.error(err);
  }
}
export async function UpdateInteractionResponse(applicationId, interactionToken, body) {
  const endpoint = `/webhooks/${applicationId}/${interactionToken}/messages/@original`;

  try {
    const request = await DiscordRequest(endpoint, { method: 'PATCH', body });
    return await request.json();
  } catch (err) {
    return console.error(err);
  }
}