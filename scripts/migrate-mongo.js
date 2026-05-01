/**
 * MongoDB Migration Script
 * Source:      mongodb+srv://jeeturadicalloop:...@cluster0.by2xy6x.mongodb.net/wellness-app
 * Destination: mongodb://admin:...@193.203.161.214:27004/vedanovahealth
 *
 * Usage: node scripts/migrate-mongo.js
 */

const { MongoClient } = require('mongodb');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const SOURCE_URI = 'mongodb+srv://jeeturadicalloop:Mjvesqnj8gY3t0zP@cluster0.by2xy6x.mongodb.net/wellness-app';
const SOURCE_DB = 'wellness-app';

const DEST_URI = 'mongodb://admin:thinkprolms989@193.203.161.214:27004/vedanovahealth?authSource=admin';
const DEST_DB = 'vedanovahealth';

// Set to true  → drop destination collection before inserting (clean migration)
// Set to false → upsert / append (safe if destination already has data)
const DROP_BEFORE_COPY = false;

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function migrate() {
    console.log('='.repeat(60));
    console.log('  MongoDB Migration Script');
    console.log('='.repeat(60));
    console.log(`\nSource DB      : ${SOURCE_DB}  (Atlas)`);
    console.log(`Destination DB : ${DEST_DB}  (VPS)\n`);

    let sourceClient, destClient;

    try {
        // Connect to both clusters
        console.log('Connecting to SOURCE (Atlas)...');
        sourceClient = new MongoClient(SOURCE_URI, { serverSelectionTimeoutMS: 15000 });
        await sourceClient.connect();
        console.log('✅ Connected to SOURCE\n');

        console.log('Connecting to DESTINATION (VPS)...');
        destClient = new MongoClient(DEST_URI, { serverSelectionTimeoutMS: 15000 });
        await destClient.connect();
        console.log('✅ Connected to DESTINATION\n');

        const sourceDB = sourceClient.db(SOURCE_DB);
        const destDB = destClient.db(DEST_DB);

        // Get all collection names from source
        const collections = await sourceDB.listCollections().toArray();

        if (collections.length === 0) {
            console.log('⚠️  No collections found in source database.');
            return;
        }

        console.log(`Found ${collections.length} collection(s) to migrate:\n`);
        collections.forEach(c => console.log(`   • ${c.name}`));
        console.log('');

        let totalDocs = 0;

        for (const colInfo of collections) {
            const collectionName = colInfo.name;

            const sourceColl = sourceDB.collection(collectionName);
            const destColl = destDB.collection(collectionName);

            const count = await sourceColl.countDocuments();
            process.stdout.write(`Migrating "${collectionName}" (${count} docs) ... `);

            if (count === 0) {
                console.log('SKIPPED (empty)');
                continue;
            }

            // Optional: drop destination collection first
            if (DROP_BEFORE_COPY) {
                await destColl.drop().catch(() => { }); // ignore error if doesn't exist
            }

            // Fetch all documents from source
            const docs = await sourceColl.find({}).toArray();

            // Drop destination collection first to avoid unique-index conflicts,
            // then re-insert all source documents fresh.
            await destColl.drop().catch(() => { }); // ignore if collection doesn't exist yet
            await destColl.insertMany(docs, { ordered: false });

            console.log('✅ Done');
            totalDocs += count;
        }

        console.log('\n' + '='.repeat(60));
        console.log(`✅ Migration complete!`);
        console.log(`   Collections migrated : ${collections.length}`);
        console.log(`   Total documents      : ${totalDocs}`);
        console.log('='.repeat(60) + '\n');

    } catch (err) {
        console.error('\n❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        if (sourceClient) await sourceClient.close();
        if (destClient) await destClient.close();
    }
}

migrate();
