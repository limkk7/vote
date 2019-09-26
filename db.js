const sqlite = require('sqlite')

const dbPromise = sqlite.open(__dirname + '/db/vote.sqlite3')
let db

module.exports = dbPromise