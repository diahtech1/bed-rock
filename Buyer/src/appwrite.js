import { Client, Account, Databases, ID, Query } from 'appwrite';

const client = new Client()
    .setEndpoint('https://fra.cloud.appwrite.io/v1')
    .setProject('bedrock');

export const account = new Account(client);
export const databases = new Databases(client);
export const DB_ID = 'bedrock-db';
export const COL_BUYER = 'buyer';
export const COL_CARDINFO = 'cardinfo';
export const COL_BUILDING = 'building';
export const COL_ROOM = 'room';
export const COL_BOOKING = 'booking';
export const COL_REVIEW = 'review';
export { ID };
export { Query }

export const syncSavedItem = (type, itemId, action) => {
    if (action === 'add') {
        setTimeout(async () => {
            try {
                const user = await account.get();
                if (!user || !user.prefs || !user.prefs.buyerId) return;
                
                const lsKey = type === 'building' ? 'bedrock_saved_buildings' : 'bedrock_saved_rooms';
                const currentSaved = localStorage.getItem(lsKey);
                if (!currentSaved || !JSON.parse(currentSaved).includes(itemId)) return;

                const col = type === 'building' ? 'savedBuildings' : 'savedRooms';
                const field = type === 'building' ? 'Building' : 'Room';
                
                const res = await databases.listDocuments(DB_ID, col, [
                    Query.equal('Buyer', user.prefs.buyerId),
                    Query.equal(field, itemId)
                ]);
                
                if (res.documents.length === 0) {
                    await databases.createDocument(DB_ID, col, ID.unique(), {
                        Buyer: user.prefs.buyerId,
                        [field]: itemId
                    });
                }
            } catch (e) {
                // Ignore
            }
        }, 5000);
    } else if (action === 'remove') {
        (async () => {
            try {
                const user = await account.get();
                if (!user || !user.prefs || !user.prefs.buyerId) return;

                const col = type === 'building' ? 'savedBuildings' : 'savedRooms';
                const field = type === 'building' ? 'Building' : 'Room';
                
                const res = await databases.listDocuments(DB_ID, col, [
                    Query.equal('Buyer', user.prefs.buyerId),
                    Query.equal(field, itemId)
                ]);
                
                if (res.documents.length > 0) {
                    for (const doc of res.documents) {
                        await databases.deleteDocument(DB_ID, col, doc.$id);
                    }
                }
            } catch (e) {
                // Ignore
            }
        })();
    }
};
