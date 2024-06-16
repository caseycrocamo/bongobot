import { getCharacterList, getCraftingProfessions } from "./gw2client.js";

async function getCraftingLevels(){
    let craftingLevels = {};
    try {
        console.log('getting characters');
        const characters = await getCharacterList();
        if(characters){
            for(const character of characters){
                console.log('getting crafting disciplines for character', character);
                const professions = await getCraftingProfessions(encodeURI(character));
                professions.crafting.forEach(profession => {
                    const name = profession.discipline;
                    if(craftingLevels[name]){
                        if(craftingLevels[name] < profession.rating){
                            craftingLevels[name] = profession.rating;
                        }
                    }
                    else{
                        craftingLevels[name] = profession.rating;
                    }
                });
            }
        }
        return craftingLevels;
    } catch (err){
        console.error(err);
    }
}
export async function getWeaponsmithLevel(){
    const craftingLevels = await getCraftingLevels();
    console.log(craftingLevels);
}
getWeaponsmithLevel();