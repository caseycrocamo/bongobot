import {
  InteractionResponseType,
} from 'discord-interactions';
import { UpdateInteractionResponse } from './discordclient.js';

export function ackInteraction(res){
  return res.send({ type: InteractionResponseType.PONG });
}
export function respondWithModal(res, message, options = {}){
    const {onlyShowToCreator, components} = options;
    let flags = generateFlags(onlyShowToCreator, components != null && components.length > 0);
    console.info('Responding with modal message with flags: ' + flags);
    return res.send({
        type: InteractionResponseType.MODAL,
        data: {
            content: message,
            components: components ?? [],
            flags: flags
        },
    });
}
export function respondWithComponentMessage(res, message, options = {}){
  const {onlyShowToCreator, components} = options;
  try{
    let flags = generateFlags(onlyShowToCreator, components != null && components.length > 0);
    console.info('Responding with component message. with flags: ' + flags);
    return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
            content: message,
            components: components ?? [],
            flags: flags
        },
    });
  } catch (err){
    console.error(err);
  }
}
export function respondWithUpdateMessage(res, message, options = {}) {
   const {onlyShowToCreator, components} = options;
    let flags = generateFlags(onlyShowToCreator, components != null && components.length > 0);
    console.info('Responding with update message. with flags: ' + flags);
    return res.send({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {
            content: message,
            components: components ?? [],
            flags: flags
        },
    });
}
export function updateChannelMessageAfterDefer(interactionToken, message, options = {}) {
  const {onlyShowToCreator, components} = options;
    let flags = generateFlags(onlyShowToCreator, components != null && components.length > 0);
    console.info('Updating channel message after defer. with flags: ' + flags);
    return UpdateInteractionResponse(process.env.APP_ID, interactionToken, {
            content: message,
            components: components ?? [],
            flags: flags
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
export function generateFlags(onlyShowToCreator, isComponentMessage){
    let flags = null;
    if(onlyShowToCreator === true){
        flags = flags | (1 << 6);
    }
    if(isComponentMessage === true){
        flags = flags | (1 << 15);
    }
    return flags;
}
