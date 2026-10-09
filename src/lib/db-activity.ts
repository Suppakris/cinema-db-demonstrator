import { db } from "@/lib/db";
import { publishOperationEvent } from "@/lib/operation-events";

type Connection = Awaited<ReturnType<typeof db.getConnection>>;
type QueryTuple = [unknown, unknown];

function describeQuery(sql: string) {
  const command = sql.trim().match(/^(SELECT|INSERT|UPDATE|DELETE|REPLACE|SHOW|DESCRIBE|EXPLAIN|SET|CALL|CREATE|ALTER|DROP)\b/i)?.[1]?.toUpperCase() ?? "SQL";
  const tables = [...sql.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+`?([A-Za-z_][A-Za-z0-9_]*)`?/gi)]
    .map((match) => match[1])
    .filter((table, index, all) => all.indexOf(table) === index);
  return { command, tables, label: `${command}${tables.length ? ` · ${tables.join(", ")}` : " statement"}` };
}

function rowCount(result: unknown) {
  if (Array.isArray(result)) return result.length;
  if (result && typeof result === "object" && "affectedRows" in result) {
    const affectedRows = Number(result.affectedRows);
    return Number.isFinite(affectedRows) ? affectedRows : null;
  }
  return null;
}

export function observeConnection(connection: Connection, operationId: string): Connection {
  return new Proxy(connection, {
    get(target, property, receiver) {
      const member = Reflect.get(target, property, receiver) as unknown;
      if (property === "query" && typeof member === "function") {
        return (...args: unknown[]) => {
          const rawSql = typeof args[0] === "string" ? args[0] : "Prepared SQL statement";
          const sql = rawSql.replace(/\s+/g, " ").trim().slice(0, 2000);
          const description = describeQuery(sql);
          publishOperationEvent(operationId, {
            kind: "SQL",
            label: description.label,
            tables: description.tables,
            sql,
            outcome: "IN PROGRESS",
            affectedRows: null,
          });
          const result = Promise.resolve(Reflect.apply(member, target, args)) as Promise<QueryTuple>;
          return result.then((tuple) => {
            publishOperationEvent(operationId, {
              kind: description.command,
              label: description.label,
              tables: description.tables,
              sql,
              outcome: description.command === "SELECT" || description.command === "SHOW" ? "READ" : "EXECUTED",
              affectedRows: rowCount(tuple[0]),
            });
            return tuple;
          }, (error: unknown) => {
            publishOperationEvent(operationId, {
              kind: description.command,
              label: description.label,
              tables: description.tables,
              sql,
              outcome: "FAILED",
              affectedRows: null,
            });
            throw error;
          });
        };
      }

      if (["beginTransaction", "commit", "rollback"].includes(String(property)) && typeof member === "function") {
        return (...args: unknown[]) => {
          const action = String(property);
          const label = action === "beginTransaction" ? "Begin transaction" : action === "commit" ? "Commit transaction" : "Roll back transaction";
          publishOperationEvent(operationId, { kind: "TRANSACTION", label, tables: [], sql: action === "beginTransaction" ? "BEGIN" : action.toUpperCase(), outcome: "IN PROGRESS", affectedRows: null });
          return Promise.resolve(Reflect.apply(member, target, args)).then((result: unknown) => {
            publishOperationEvent(operationId, { kind: "TRANSACTION", label, tables: [], sql: action === "beginTransaction" ? "BEGIN" : action.toUpperCase(), outcome: action === "commit" ? "COMMITTED" : action === "rollback" ? "ROLLED BACK" : "ACTIVE", affectedRows: 0 });
            return result;
          }, (error: unknown) => {
            publishOperationEvent(operationId, { kind: "TRANSACTION", label, tables: [], sql: action === "beginTransaction" ? "BEGIN" : action.toUpperCase(), outcome: "FAILED", affectedRows: null });
            throw error;
          });
        };
      }
      return typeof member === "function" ? member.bind(target) : member;
    },
  });
}
