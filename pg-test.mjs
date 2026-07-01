import EmbeddedPostgres from 'embedded-postgres';

const pg = new EmbeddedPostgres({
  databaseDir: '/tmp/serveflow-pgdata',
  user: 'serveflow',
  password: 'serveflow',
  port: 5432,
  persistent: false,
});

await pg.initialise();
await pg.start();
await pg.createDatabase('serveflow');
console.log('PG STARTED OK');
const client = pg.getPgClient();
await client.connect();
const res = await client.query('select version()');
console.log(res.rows[0]);
await client.end();
