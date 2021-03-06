module.exports = (db) => {
    return Promise.all([
        db.collection('users').createIndex({
            facebook_id: 1,
        }, {
            unique: true,
            partialFilterExpression: {
                facebook_id: {$exists: true},
            }
        }),
    ]);
};
