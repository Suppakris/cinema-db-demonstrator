export type SchemaKey = { kind: "PK" | "FK" | "UQ"; name: string };
export type SchemaColumn = {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | number | null;
  extra: string;
  keys: SchemaKey[];
};
export type SchemaObject = {
  name: string;
  type: "BASE TABLE" | "VIEW";
  recordCount: number;
  columns: SchemaColumn[];
};
export type SchemaRelationship = {
  constraintName: string;
  fromTable: string;
  fromColumns: string[];
  toTable: string;
  toColumns: string[];
  cardinality: "1:1" | "1:N";
  optional: boolean;
};
export type SchemaData = {
  database: string;
  summary: { objectCount: number; tableCount: number; viewCount: number; tableRecordCount: number };
  objects: SchemaObject[];
  relationships: SchemaRelationship[];
};
