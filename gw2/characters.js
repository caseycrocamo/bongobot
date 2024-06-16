import { getCharacterList, getCraftingProfessions } from "./gw2client.js";

async function getCraftingLevels(){
    let craftingLevels = {};
    try {
        console.log('getting characters');
        const characters = await getCharacterList();
        if(characters){
            const promises = characters.map(async character => {
                console.log('getting crafting professions for', character);
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
            });
            await Promise.all(promises);
        }
        return craftingLevels;
    } catch (err){
        console.error(err);
    }
}
export async function getMaxLevelCraftingDisciplines(){
    let disciplines = [];
    const craftingLevels = await getCraftingLevels();
    Object.keys(craftingLevels).forEach((discipline) => {
        if(craftingLevels[discipline] == 500){
            disciplines.push(discipline);
        }
      });
    return disciplines;
}
getMaxLevelCraftingDisciplines();