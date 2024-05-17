import 'dotenv/config';
import { MongoClient, ServerApiVersion } from "mongodb";
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
export async function insertMemberRoleAssignment(userId, guildId, roleId){
    const doc = { userId, guildId, roleId };
    const result = await insertOne("MemberRoles", doc);
    console.log(
    `A MemberRole {${doc}} was inserted with document _id: ${result.insertedId}`,
    );
    return result.insertedId;
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
export async function getMemberRole(userId, guildId){
    const query = { userId, guildId};
    return await getFromCollection("MemberRoles", query);
}

await ping();