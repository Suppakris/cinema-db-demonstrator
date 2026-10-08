import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type ColumnRow = RowDataPacket & { columnName: string; ordinalPosition: number };
type PrimaryKeyRow = RowDataPacket & { columnName: string; ordinalPosition: number };
type CountRow = RowDataPacket & { total: number | string };

type RouteContext = { params: Promise<{ tableName: string }> };

function quoteIdentifier(identifier: string) {
  return `\`${identifier.replace(/`/g, "``")}\``;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { tableName } = await context.params;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
    return NextResponse.json({ error: "Choose a valid database table." }, { status: 400 });
  }

  const limitValue = Number(request.nextUrl.searchParams.get("limit") ?? 25);
  const offsetValue = Number(request.nextUrl.searchParams.get("offset") ?? 0);
  const limit = Number.isInteger(limitValue) ? Math.min(Math.max(limitValue, 1), 50) : 25;
  const offset = Number.isInteger(offsetValue) ? Math.max(offsetValue, 0) : 0;
  const rawFilter = request.nextUrl.searchParams.get("filter");
  let filter: Record<string, unknown> = {};
  if (rawFilter) {
    try {
      const parsed = JSON.parse(rawFilter);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.keys(parsed).length > 4) {
        return NextResponse.json({ error: "The row filter is invalid." }, { status: 400 });
      }
      filter = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "The row filter is invalid." }, { status: 400 });
    }
  }

  let connection: Awaited<ReturnType<typeof db.getConnection>>;
  try {
    connection = await db.getConnection();
  } catch {
    return NextResponse.json({ error: "The database is currently unavailable." }, { status: 503 });
  }

  try {
    const [tableRows] = await connection.query<RowDataPacket[]>(
      `SELECT TABLE_TYPE AS tableType FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
      [tableName],
    );
    if (tableRows.length === 0 || tableRows[0].tableType !== "BASE TABLE") {
      return NextResponse.json({ error: "This object is not an available base table." }, { status: 404 });
    }

    const [columnRows] = await connection.query<ColumnRow[]>(
      `SELECT COLUMN_NAME AS columnName, ORDINAL_POSITION AS ordinalPosition
       FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [tableName],
    );
    const [primaryKeyRows] = await connection.query<PrimaryKeyRow[]>(
      `SELECT COLUMN_NAME AS columnName, ORDINAL_POSITION AS ordinalPosition
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
       ORDER BY ORDINAL_POSITION`,
      [tableName],
    );

    const columns = columnRows.map((column) => column.columnName);
    const invalidFilterColumn = Object.keys(filter).some((column) => !columns.includes(column));
    const invalidFilterValue = Object.values(filter).some((value) =>
      value !== null && typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean",
    );
    if (invalidFilterColumn || invalidFilterValue) {
      return NextResponse.json({ error: "The row filter does not match this table." }, { status: 400 });
    }

    const whereSql = Object.keys(filter).map((column) => `${quoteIdentifier(column)} <=> ?`).join(" AND ");
    const whereClause = whereSql ? ` WHERE ${whereSql}` : "";
    const filterValues = Object.keys(filter).map((column) => filter[column]);
    const quotedTable = quoteIdentifier(tableName);
    const [countRows] = await connection.query<CountRow[]>(
      `SELECT COUNT(*) AS total FROM ${quotedTable}${whereClause}`,
      filterValues,
    );
    const orderBy = primaryKeyRows.length
      ? ` ORDER BY ${primaryKeyRows.map((column) => quoteIdentifier(column.columnName)).join(", ")}`
      : "";
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT * FROM ${quotedTable}${whereClause}${orderBy} LIMIT ? OFFSET ?`,
      [...filterValues, limit, offset],
    );

    return NextResponse.json({
      table: tableName,
      total: Number(countRows[0]?.total ?? 0),
      limit,
      offset,
      columns,
      primaryKey: primaryKeyRows.map((column) => column.columnName),
      rows,
    });
  } catch {
    return NextResponse.json({ error: "Database records could not be loaded." }, { status: 503 });
  } finally {
    connection.release();
  }
}
