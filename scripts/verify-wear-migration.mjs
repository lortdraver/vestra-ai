import fs from 'node:fs'
import { Pool } from 'pg'

function readEnvFile() {
  if (!fs.existsSync('.env.local')) return {}

  return Object.fromEntries(
    fs
      .readFileSync('.env.local', 'utf8')
      .split(/\r?\n/)
      .map((line) => line.match(/^([^#=]+)=(.*)$/))
      .filter(Boolean)
      .map((match) => [
        match[1].trim(),
        match[2].trim().replace(/^['"]|['"]$/g, ''),
      ]),
  )
}

const env = readEnvFile()
const pool = new Pool({
  connectionString: env.DATABASE_URL ?? process.env.DATABASE_URL,
})

try {
  const tables = await pool.query(
    `select table_name
       from information_schema.tables
      where table_schema = 'public'
        and table_name in (
          'wear_log',
          'wear_log_item',
          'outfit_generation_batch',
          'stylist_preference_profile',
          'outfit_plan'
        )
      order by table_name`,
  )
  const indexes = await pool.query(
    `select tablename, indexname
       from pg_indexes
      where schemaname = 'public'
        and tablename in (
          'wear_log',
          'wear_log_item',
          'outfit_generation_batch',
          'stylist_preference_profile',
          'outfit_plan',
          'outfit',
          'outfit_feedback'
        )
      order by tablename, indexname`,
  )
  const columns = await pool.query(
    `select table_name, column_name
       from information_schema.columns
      where table_schema = 'public'
        and table_name in ('outfit', 'outfit_feedback', 'outfit_plan')
        and column_name in (
          'generationBatchId',
          'styleDirection',
          'seasonLabel',
          'formalityLabel',
          'reasonTags',
          'startAt',
          'endAt',
          'allDay',
          'timezone',
          'locationName',
          'latitude',
          'longitude',
          'status',
          'source'
        )
      order by table_name, column_name`,
  )

  console.log(
    JSON.stringify(
      {
        tables: tables.rows.map((row) => row.table_name),
        indexes: indexes.rows,
        columns: columns.rows,
      },
      null,
      2,
    ),
  )
} finally {
  await pool.end()
}
