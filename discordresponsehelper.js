import {
  InteractionResponseType,
} from 'discord-interactions';

export function ackInteraction(res){
  return res.send({ type: InteractionResponseType.PONG });
}
export function respondWithModal(res, message, options = {}){
  const {onlyShowToCreator, components} = options;
    return res.send({
        type: InteractionResponseType.MODAL,
        data: {
            content: message,
            components,
            flags: generateFlags(onlyShowToCreator)
        },
    });
}
export function respondWithComponentMessage(res, message, options = {}){
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
export async function respondWithCommandNotImplemented(res){
  return respondWithComponentMessage(res, 'Command is not implemented yet. Try again later or message @sif', {onlyShowToCreator: true});
}
function generateFlags(onlyShowToCreator){
  if(onlyShowToCreator){
    return 1 << 6;
  }
}
