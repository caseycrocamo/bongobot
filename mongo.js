import 'dotenv/config';
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGO_CONNECTION,  {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        }
    }
);
async function ping() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch {
    console.error('Issue connecting to mongo, check your connectionstring');
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
async function insertOne(collection, doc){
    try{
        await client.connect();
        const db = client.db("BongoBot");
        const col = db.collection(collection);
        const result = await col.insertOne(doc);
        console.log(result);
        return result.insertedId;
    } catch {
        console.error(`Issue inserting into ${collection}`);
    }
}
async function updateOne(collection, filter, updateDocument){
    try{
        await client.connect();
        const db = client.db("BongoBot");
        const col = db.collection(collection);
        const result = await col.updateOne(filter, updateDocument);
        return result.modifiedCount;
    } catch {
        console.error(`Issue updating item in ${collection}`);
    }
}
async function getFromCollection(collection, query){
    try{
        await client.connect();
        const db = client.db("BongoBot");
        const col = db.collection(collection);
        const cursor = await col.find(query);
        return await cursor.toArray();
    } catch {
        console.error(`Issue getting from ${collection}`);
    }
}
export async function removeFromCollection(collection, query){
    try{
        await client.connect();
        const db = client.db("BongoBot");
        const col = db.collection(collection);
        const deletionResponse = await col.deleteMany(query);
        return await deletionResponse.deletedCount;
    } catch {
        console.error(`Issue deleting from ${collection}`);
    }
}
async function deleteOne(collection, documentId){
    try{
        await client.connect();
        const db = client.db("BongoBot");
        const col = db.collection(collection);
        const deletionResponse = await col.deleteOne({
            "_id": new ObjectId(documentId)
        });
        return deletionResponse.deletedCount;
    } catch {
        console.error(`Issue deleting from ${collection}`);
    }
}
export async function insertMemberRoleAssignment(userId, guildId, roleId){
    const doc = { userId, guildId, roleId };
    const result = await insertOne("MemberRoles", doc);
    console.log('A MemberRole ', doc, ' was inserted');
    return result._id;
}
export async function updateMemberRoleAssignment(userId, guildId, roleId){
    const filter = { userId, guildId};
    const updateDocument = {
        $set: {
            roleId
        }
    }
    const result = await updateOne("MemberRoles", filter, updateDocument);
    console.log('A MemberRole ',filter, `was updated to role: ${roleId}`);
    return result;
}
export async function removeMemberRole(userId, guildId, roleId){
    const query = {userId, guildId, roleId};
    return await removeFromCollection('MemberRoles', query);
}
export async function getMemberRole(userId, guildId){
    const query = { userId, guildId};
    return await getFromCollection("MemberRoles", query);
}
export async function insertMemberAchievement(userId, guildId, achievementId){
    const doc = {userId, guildId, achievementId};
    const result = await insertOne("MemberAchievement", doc);
    console.log('A MemberAchievement was inserted: ', doc);
    return result.insertedId;
}
export async function getAllMemberAchievements(userId, guildId){
    const query = {userId, guildId};
    return await getFromCollection("MemberAchievement", query);
}
export async function getMemberAchievement(userId, guildId, achievementId){
    const query = {userId, guildId, achievementId};
    return await getFromCollection("MemberAchievement", query);
}
export async function deleteMemberAchievement(documentId){
    const query = { "_id": new ObjectId(documentId)};
    const doc = await getFromCollection("MemberAchievement", query);
    if(doc.length === 0) {
        console.error("no document found to delete in MemberAchievement");
        return null;
    }
    else{
        const deleteCount = await deleteOne("MemberAchievement", documentId);
        return deleteCount;
    }
}
export async function insertMemberApiKey(userId, apiKey){
    const doc = {userId, apiKey};
    const result = await insertOne("MemberApiKey", doc);
    console.log('A MemberApiKey ', doc, 'was inserted with document _id: ', result.insertedId);
    return result.insertedId;
}
export async function getMemberApiKey(userId){
    const query = {userId};
    return await getFromCollection("MemberApiKey", query);
}
export async function updateMemberApiKey(userId, apiKey){
    const filter = { userId };
    const updateDocument = {
        $set: {
            apiKey
        }
    }
    const result = await updateOne("MemberApiKey", filter, updateDocument);
    console.log('A MemberApiKey ',filter, `was updated`);
    return result;
}

export async function ensureManagedRoleIndexes(){
    try{
        await client.connect();
        const db = client.db("BongoBot");
        const col = db.collection("ManagedRole");
        await col.createIndex({ guildId: 1, custom_id: 1 }, { unique: true });
    } catch {
        console.error("Issue ensuring indexes on ManagedRole");
    }
}
export async function insertManagedRole(doc){
    await ensureManagedRoleIndexes();
    try{
        await client.connect();
        const db = client.db("BongoBot");
        const col = db.collection("ManagedRole");
        const result = await col.insertOne(doc);
        return result.insertedId;
    } catch {
        console.error("Issue inserting into ManagedRole");
    }
}
export async function deleteManagedRole(id){
    try{
        await client.connect();
        const db = client.db("BongoBot");
        const col = db.collection("ManagedRole");
        const deletionResponse = await col.deleteOne({ _id: new ObjectId(id) });
        return deletionResponse.deletedCount;
    } catch {
        console.error("Issue deleting from ManagedRole");
    }
}
export async function upsertManagedRole(doc){
    try{
        await client.connect();
        const db = client.db("BongoBot");
        const col = db.collection("ManagedRole");
        const result = await col.updateOne(
            { guildId: doc.guildId, custom_id: doc.custom_id },
            { $set: doc },
            { upsert: true }
        );
        return {
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
            upsertedCount: result.upsertedCount || 0
        };
    } catch {
        console.error("Issue upserting into ManagedRole");
    }
}
export async function bulkUpsertManagedRoles(docs){
    const summary = { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
    if (!Array.isArray(docs) || docs.length === 0) {
        return summary;
    }
    try{
        await client.connect();
        const db = client.db("BongoBot");
        const col = db.collection("ManagedRole");
        const CHUNK_SIZE = 1000;
        for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
            const chunk = docs.slice(i, i + CHUNK_SIZE);
            const operations = chunk.map(doc => ({
                updateOne: {
                    filter: { guildId: doc.guildId, custom_id: doc.custom_id },
                    update: { $set: doc },
                    upsert: true
                }
            }));
            const result = await col.bulkWrite(operations, { ordered: false });
            summary.matchedCount += result.matchedCount || 0;
            summary.modifiedCount += result.modifiedCount || 0;
            summary.upsertedCount += result.upsertedCount || 0;
        }
        return summary;
    } catch {
        console.error("Issue bulk upserting into ManagedRole");
    }
}
export async function getAllManagedRoles(guildId){
    try{
        await client.connect();
        const db = client.db("BongoBot");
        const col = db.collection("ManagedRole");
        const projection = {
            _id: 0,
            type: 1,
            short_name: 1,
            description: 1,
            category: 1,
            custom_id: 1,
            name: 1,
            color: 1,
            mentionable: 1,
            icon: 1,
            requirements: 1,
            discordRoleId: 1
        };
        const cursor = await col.find({ guildId }, { projection });
        return await cursor.toArray();
    } catch {
        console.error("Issue getting from ManagedRole");
        return [];
    }
}
export async function updateManagedRoleDiscordId(guildId, custom_id, discordRoleId){
    try{
        await client.connect();
        const db = client.db("BongoBot");
        const col = db.collection("ManagedRole");
        const result = await col.updateOne(
            { guildId, custom_id },
            { $set: { discordRoleId } }
        );
        return result.modifiedCount;
    } catch {
        console.error("Issue updating discordRoleId in ManagedRole");
    }
}

// ---------------------------------------------------------------------------
// Game collection (admin-only grouping of Categories; not surfaced to the bot)
// ---------------------------------------------------------------------------
export async function ensureGameIndexes(){
    try{
        await client.connect();
        const db = client.db("BongoBot");
        const col = db.collection("Game");
        await col.createIndex({ guildId: 1, slug: 1 }, { unique: true });
    } catch {
        console.error("Issue ensuring indexes on Game");
    }
}
// Inserts a Game. Lets errors (incl. duplicate-key 11000) propagate so callers
// can translate a duplicate slug into a 409.
export async function insertGame(doc){
    await ensureGameIndexes();
    await client.connect();
    const db = client.db("BongoBot");
    const col = db.collection("Game");
    const result = await col.insertOne(doc);
    return result.insertedId;
}
export async function getAllGames(guildId){
    try{
        await client.connect();
        const db = client.db("BongoBot");
        const col = db.collection("Game");
        const projection = { _id: 1, name: 1, slug: 1 };
        const cursor = await col.find({ guildId }, { projection });
        return await cursor.toArray();
    } catch {
        console.error("Issue getting from Game");
        return [];
    }
}
// Resolve a Game by its _id for this guild. Returns null on unknown id or a
// malformed ObjectId (ObjectId() throws -> caught).
export async function getGameById(guildId, id){
    try{
        await client.connect();
        const db = client.db("BongoBot");
        const col = db.collection("Game");
        return await col.findOne({ _id: new ObjectId(id), guildId });
    } catch {
        return null;
    }
}
// Idempotent upsert keyed on { guildId, slug }; returns the resulting document
// (so migrations get the _id on both insert and match paths).
export async function upsertGame(doc){
    await client.connect();
    const db = client.db("BongoBot");
    const col = db.collection("Game");
    await col.updateOne(
        { guildId: doc.guildId, slug: doc.slug },
        { $set: doc },
        { upsert: true }
    );
    return await col.findOne({ guildId: doc.guildId, slug: doc.slug });
}

// ---------------------------------------------------------------------------
// Category collection (authoritative list of category names + owning Game)
// ---------------------------------------------------------------------------
export async function ensureCategoryIndexes(){
    try{
        await client.connect();
        const db = client.db("BongoBot");
        const col = db.collection("Category");
        await col.createIndex({ guildId: 1, slug: 1 }, { unique: true });
    } catch {
        console.error("Issue ensuring indexes on Category");
    }
}
// Inserts a Category. Lets errors (incl. duplicate-key 11000) propagate.
export async function insertCategory(doc){
    await ensureCategoryIndexes();
    await client.connect();
    const db = client.db("BongoBot");
    const col = db.collection("Category");
    const result = await col.insertOne(doc);
    return result.insertedId;
}
export async function getAllCategories(guildId){
    try{
        await client.connect();
        const db = client.db("BongoBot");
        const col = db.collection("Category");
        const projection = { _id: 0, name: 1, slug: 1, gameId: 1, order: 1 };
        const cursor = await col.find({ guildId }, { projection }).sort({ order: 1 });
        return await cursor.toArray();
    } catch {
        console.error("Issue getting from Category");
        return [];
    }
}
// Next order value for a new admin-created category (append after existing).
export async function getNextCategoryOrder(guildId){
    try{
        await client.connect();
        const db = client.db("BongoBot");
        const col = db.collection("Category");
        const top = await col.find({ guildId }).sort({ order: -1 }).limit(1).toArray();
        return (top.length && Number.isFinite(top[0].order)) ? top[0].order + 1 : 0;
    } catch {
        console.error("Issue computing next category order");
        return 0;
    }
}
export async function bulkUpsertCategories(docs){
    const summary = { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
    if (!Array.isArray(docs) || docs.length === 0) {
        return summary;
    }
    try{
        await client.connect();
        const db = client.db("BongoBot");
        const col = db.collection("Category");
        const operations = docs.map(doc => ({
            updateOne: {
                filter: { guildId: doc.guildId, slug: doc.slug },
                update: { $set: doc },
                upsert: true
            }
        }));
        const result = await col.bulkWrite(operations, { ordered: false });
        summary.matchedCount += result.matchedCount || 0;
        summary.modifiedCount += result.modifiedCount || 0;
        summary.upsertedCount += result.upsertedCount || 0;
        return summary;
    } catch {
        console.error("Issue bulk upserting into Category");
    }
}

await ping();