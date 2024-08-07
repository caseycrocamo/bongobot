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
    finally {
        await client.close();
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
    finally {
        await client.close();
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
    finally {
        await client.close();
    }
}
async function removeFromCollection(collection, query){
    try{
        await client.connect();
        const db = client.db("BongoBot");
        const col = db.collection(collection);
        const deletionResponse = await col.deleteMany(query);
        return await deletionResponse.deletedCount;
    } catch {
        console.error(`Issue deleting from ${collection}`);
    }
    finally {
        await client.close();
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
    finally {
        await client.close();
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
export async function insertMemberCommandState(userId, targetId){
    const doc = {userId, targetId};
    const result = await insertOne("MemberCommandState", doc);
    console.log('A MemberCommandState ', doc, 'was inserted with document _id: ', result.insertedId);
    return result.insertedId;
}
export async function getMemberCommandState(userId){
    const query = {userId};
    return await getFromCollection("MemberCommandState", query);
}
export async function removeMemberCommandState(userId){
    const query = {userId};
    const response = await removeFromCollection("MemberCommandState", query);
    console.log('deleted ', response, ' state(s) from MemberCommandState');
    return response;
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

await ping();