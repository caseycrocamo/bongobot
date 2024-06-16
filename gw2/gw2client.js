import 'dotenv/config';
import fetch from 'node-fetch';

export async function getCraftingProfessions(characterId){
    const response = await GW2Request(`characters/${characterId}/crafting`, {method: 'GET'});
    return await response.json();
}

export async function getCharacterList(){
    const response = await GW2Request('characters', {method: 'GET'});
    return await response.json()
}

export async function GW2Request(endpoint, options) {
  // append endpoint to root API URL
  const url = 'https://api.guildwars2.com/v2/' + endpoint;
  // Stringify payloads
  if (options?.body) options.body = JSON.stringify(options.body);
  // Use node-fetch to make requests
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.GW2_API_KEY}`,
      'Content-Type': 'application/json; charset=UTF-8',
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