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
import { VerifyDiscordRequest, getRandomEmoji, DiscordRequest } from './utils.js';

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// Parse request body and verifies incoming requests using discord-interactions package
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
app.post('/interactions', async function (req, res) {
  // Interaction type and data
  const { type, id, data } = req.body;

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
    const { name } = data;

    switch(name){
        case 'test':
            return respondWithMessage(res);
        case 'timestamp':
            return respondWithModal(res);
        default:
            console.log(`no match on interaction ${name}`);
            return null;
    }
  }
});

function respondWithModal(res){
    return res.send({
        custom_id:'timestamp_modal',
        type: InteractionResponseType.MODAL,
        components: [{
            type: MessageComponentTypes.ACTION_ROW,
            components: [{
              type: MessageComponentTypes.INPUT_TEXT,
              custom_id: 'time',
              label: 'Time',
              style: TextStyleTypes.SHORT,
              min_length: 1,
              max_length: 4000,
              placeholder: "5:00 pm",
              required: true
            }]
          }]
    });
}

// Send a message into the channel where command was triggered from
function respondWithMessage(res){
    return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            // Fetches a random emoji to send from a helper function
            content: 'hello world ' + getRandomEmoji(),
        },
    });
}

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
