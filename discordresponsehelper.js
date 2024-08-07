import {
  InteractionResponseType,
} from 'discord-interactions';
import { UpdateInteractionResponse } from './discordclient.js';

export function ackInteraction(res){
  return res.send({ type: InteractionResponseType.PONG });
}
export function respondWithModal(res, message, options = {}){
  const {onlyShowToCreator, components} = options;
    return res.send({
        type: InteractionResponseType.MODAL,
        data: {
            content: message,
            components: components ?? [],
            flags: generateFlags(onlyShowToCreator)
        },
    });
}
export function respondWithComponentMessage(res, message, options = {}){
  const {onlyShowToCreator, components} = options;
  try{
    return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: message,
            components: components ?? [],
            flags: generateFlags(onlyShowToCreator)
        },
    });
  } catch (err){
    console.error(err);
  }
}
export function respondWithUpdateMessage(res, message, options = {}) {
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
export function updateChannelMessageAfterDefer(interactionToken, message, options = {}) {
  const {onlyShowToCreator, components} = options;
    return UpdateInteractionResponse(process.env.APP_ID, interactionToken, {
            content: message,
            components: components ?? [],
            flags: generateFlags(onlyShowToCreator)
        });
}
export function respondWithDeferMessage(res, onlyShowToCreator = true) {
    return res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            flags: generateFlags(onlyShowToCreator)
        },
    });
}
export function respondWithDeferUpdate(res) {
    return res.send({
        type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
    });
}
export async function respondWithCommandNotImplemented(res){
  return respondWithComponentMessage(res, 'Command is not implemented yet. Try again later or message @sif', {onlyShowToCreator: true});
}
export function generateFlags(onlyShowToCreator){
  if(onlyShowToCreator === true){
    return 1 << 6;
  }
  return null;
}
