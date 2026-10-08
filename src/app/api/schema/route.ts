import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type ObjectRow = RowDataPacket & {
  objectName: string;
  objectType: "BASE TABLE" | "VIEW";
};

type ColumnRow = RowDataPacket & {
  objectName: string;
  name: string;
  columnType: string;
  nullable: "YES" | "NO";
  defaultValue: string | number | null;
  extra: string;
  ordinalPosition: number;
};

type KeyRow = RowDataPacket & {
  objectName: string;
  constraintName: string;
  constraintType: "PRIMARY KEY" | "FOREIGN KEY" | "UNIQUE";
  columnName: string;
  referencedTable: string | null;
  referencedColumn: string | null;
  ordinalPosition: number;
};

type CountRow = RowDataPacket & {
  objectName: string;
  recordCount: number | string;
};

export async function GET() {
  let connection: Awaited<ReturnType<typeof db.getConnection>>;
  try {
    connection = await db.getConnection();
  } catch {
    return NextResponse.json({ error: "The database is currently unavailable." }, { status: 503 });
  }

  try {
    const [[databaseRow]] = await connection.query<RowDataPacket[]>("SELECT DATABASE() AS databaseName");
    const [objectRows] = await connection.query<ObjectRow[]>(
      `SELECT TABLE_NAME AS objectName, TABLE_TYPE AS objectType
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
       ORDER BY TABLE_TYPE, TABLE_NAME`,
    );
    const [columnRows] = await connection.query<ColumnRow[]>(
      `SELECT TABLE_NAME AS objectName, COLUMN_NAME AS name, COLUMN_TYPE AS columnType,
              IS_NULLABLE AS nullable, COLUMN_DEFAULT AS defaultValue, EXTRA AS extra,
              ORDINAL_POSITION AS ordinalPosition
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
       ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    );
    const [keyRows] = await connection.query<KeyRow[]>(
      `SELECT k.TABLE_NAME AS objectName, k.CONSTRAINT_NAME AS constraintName,
              tc.CONSTRAINT_TYPE AS constraintType, k.COLUMN_NAME AS columnName,
              k.REFERENCED_TABLE_NAME AS referencedTable,
              k.REFERENCED_COLUMN_NAME AS referencedColumn,
              k.ORDINAL_POSITION AS ordinalPosition
       FROM information_schema.KEY_COLUMN_USAGE k
       JOIN information_schema.TABLE_CONSTRAINTS tc
         ON tc.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
        AND tc.TABLE_NAME = k.TABLE_NAME
        AND tc.CONSTRAINT_NAME = k.CONSTRAINT_NAME
       WHERE k.CONSTRAINT_SCHEMA = DATABASE()
         AND tc.CONSTRAINT_TYPE IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE')
       ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION`,
    );

    const safeObjects = objectRows.filter((object) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(object.objectName));
    const countQueries = safeObjects.map((object) => {
      const name = object.objectName;
      const quotedName = `\`${name.replace(/`/g, "``")}\``;
      return `SELECT '${name}' AS objectName, COUNT(*) AS recordCount FROM ${quotedName}`;
    });
    const countSql = countQueries.length > 0 ? countQueries.join(" UNION ALL ") : null;
    let countRows: CountRow[] = [];
    if (countSql) {
      const [rows] = await connection.query<CountRow[]>(countSql);
      countRows = rows;
    }

    const columnKeys = new Map<string, Map<string, Array<{ kind: "PK" | "FK" | "UQ"; name: string }>>>();
    const relationMap = new Map<string, {
      constraintName: string;
      fromTable: string;
      fromColumns: string[];
      toTable: string;
      toColumns: string[];
    }>();

    for (const key of keyRows) {
      const objectName = key.objectName;
      const tableKeys = columnKeys.get(objectName) ?? new Map<string, Array<{ kind: "PK" | "FK" | "UQ"; name: string }>>();
      const keys = tableKeys.get(key.columnName) ?? [];
      const kind = key.constraintType === "PRIMARY KEY" ? "PK" : key.constraintType === "FOREIGN KEY" ? "FK" : "UQ";
      if (!keys.some((existing) => existing.name === key.constraintName)) {
        keys.push({ kind, name: key.constraintName });
      }
      tableKeys.set(key.columnName, keys);
      columnKeys.set(objectName, tableKeys);

      if (key.constraintType === "FOREIGN KEY" && key.referencedTable && key.referencedColumn) {
        const relationKey = `${objectName}:${key.constraintName}`;
        const relation = relationMap.get(relationKey) ?? {
          constraintName: key.constraintName,
          fromTable: objectName,
          fromColumns: [],
          toTable: key.referencedTable,
          toColumns: [],
        };
        relation.fromColumns.push(key.columnName);
        relation.toColumns.push(key.referencedColumn);
        relationMap.set(relationKey, relation);
      }
    }

    const counts = new Map(countRows.map((row) => [row.objectName, Number(row.recordCount)]));
    const columnsByObject = new Map<string, ColumnRow[]>();
    for (const column of columnRows) {
      const columns = columnsByObject.get(column.objectName) ?? [];
      columns.push(column);
      columnsByObject.set(column.objectName, columns);
    }

    const objects = safeObjects.map((object) => ({
      name: object.objectName,
      type: object.objectType,
      recordCount: counts.get(object.objectName) ?? 0,
      columns: (columnsByObject.get(object.objectName) ?? []).map((column) => ({
        name: column.name,
        type: column.columnType,
        nullable: column.nullable === "YES",
        defaultValue: column.defaultValue,
        extra: column.extra,
        keys: columnKeys.get(object.objectName)?.get(column.name) ?? [],
      })),
    }));

    const tableObjects = objects.filter((object) => object.type === "BASE TABLE");
    return NextResponse.json({
      database: databaseRow.databaseName,
      summary: {
        objectCount: objects.length,
        tableCount: tableObjects.length,
        viewCount: objects.length - tableObjects.length,
        tableRecordCount: tableObjects.reduce((total, object) => total + object.recordCount, 0),
      },
      objects,
      relationships: [...relationMap.values()],
    });
  } catch {
    return NextResponse.json({ error: "Database schema metadata could not be loaded." }, { status: 503 });
  } finally {
    connection.release();
  }
}
