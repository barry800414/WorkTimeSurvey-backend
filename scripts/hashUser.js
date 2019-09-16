const { MongoClient } = require("mongodb");

const { MONGODB_URI, MONGODB_DBNAME } = process.env;

/** ref: https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript */
String.prototype.hashCode = function() {
    var hash = 0,
        i,
        chr;
    if (this.length === 0) return hash;
    for (i = 0; i < this.length; i++) {
        chr = this.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash < 0 ? -1 * hash : hash;
};

(async () => {
    const client = await MongoClient.connect(MONGODB_URI, {
        useNewUrlParser: true,
    });
    const db = await client.db(MONGODB_DBNAME);

    try {
        // hide `users` collection sensitive information
        const users = await db
            .collection("users")
            .find({})
            .toArray();
        let tasks = [];
        let count = 0;
        for (let user of users) {
            const set = {};
            if (user.facebook_id) {
                const hashFacebookId = `${user.facebook_id.hashCode()}`;
                set.facebook_id = hashFacebookId;
                set["facebook.id"] = hashFacebookId;
            }
            if (user.facebook && user.facebook.name) {
                const hashName = `${user.facebook.name.hashCode()}`;
                set["facebook.name"] = hashName;
            }
            if (user.email) {
                set.email = `findyourgoodjob${count}@gmail.com`;
                count += 1;
            }

            tasks.push({
                updateOne: {
                    filter: { _id: user._id },
                    update: { $set: set },
                },
            });
        }
        let result = await db.collection("users").bulkWrite(tasks);
        console.log("ok:", result.ok);
        console.log("nModified:", result.nModified);

        // hide `workings` collection sensitive information
        const workings = await db
            .collection("workings")
            .find({})
            .toArray();

        tasks = [];
        count = 0;
        for (let working of workings) {
            const set = {};
            if (working.author && working.author.id) {
                const hashId = `${working.author.id.hashCode()}`;
                set["author.id"] = hashId;
            }
            if (working.author && working.author.name) {
                const hashName = `${working.author.name.hashCode()}`;
                set["author.name"] = hashName;
            }
            if (working.author && working.author.email) {
                set["author.email"] = `findyourgoodjob${count}@gmail.com`;
                count += 1;
            }
            if (Object.keys(set).length > 0) {
                tasks.push({
                    updateOne: {
                        filter: { _id: working._id },
                        update: { $set: set },
                    },
                });
            }
        }
        result = await db.collection("workings").bulkWrite(tasks);
        console.log("ok:", result.ok);
        console.log("nModified:", result.nModified);

        // drop `recommendations` collection
        await db.collection("recommendations").drop();

        await client.close();
    } catch (err) {
        console.log(err);
    }
})();
