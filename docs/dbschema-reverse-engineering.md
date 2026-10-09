# Reverse-engineer the live schema with DbSchema

The `/schema` page reads table, column, key, and foreign-key metadata from the configured MySQL database. DbSchema can use that same database as the authoritative source when you need a detailed design model.

## Connect and inspect

1. Open DbSchema and choose **Connect to Server** → **MySQL**.
2. Use the host, port, database name, and TLS settings from the local deployment configuration. Do not copy credentials into this repository or share them in screenshots.
3. Connect with a database account that has metadata access and `SELECT` access only. The application does not require DbSchema to change the schema.
4. Run DbSchema's **Reverse Engineer** / **Get Schema** action for the configured database. Include tables, views, indexes, and foreign keys in the import.
5. Compare the imported tables and relationships with `/schema`; refresh the database model after approved schema changes.

Use DbSchema's database-to-model direction for this workflow. Do not synchronize model changes back to MySQL from this project without a separately reviewed migration and approval. The application does not create a second schema or database.

## Application metadata source

`GET /api/schema` reads `information_schema.TABLES`, `COLUMNS`, `KEY_COLUMN_USAGE`, and `TABLE_CONSTRAINTS` for `DATABASE()`. It derives one-to-one cardinality only when the child foreign-key columns exactly match a primary or unique key; otherwise it reports one-to-many. A nullable child foreign key is marked optional. This is metadata-derived cardinality and does not assert that every parent has a child row.
