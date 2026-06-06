import process from "node:process";
import { Pool, type QueryResultRow } from "pg";

type DbFilter = {
  column: string;
  op: "eq" | "neq" | "not";
  operator?: string;
  value: unknown;
};

type DbOrder = {
  column: string;
  ascending?: boolean;
};

export type DbOperation = {
  table: string;
  action: "select" | "insert" | "update" | "delete" | "upsert";
  columns?: string;
  returningColumns?: string;
  filters?: DbFilter[];
  orders?: DbOrder[];
  limit?: number;
  single?: boolean;
  maybeSingle?: boolean;
  payload?: Record<string, unknown> | Record<string, unknown>[];
  onConflict?: string;
};

const TABLE_COLUMNS = {
  services: [
    "id",
    "category",
    "name",
    "price",
    "description",
    "sort_order",
    "published",
    "created_at",
    "updated_at",
  ],
  price_files: ["id", "title", "file_url", "file_name", "sort_order", "created_at"],
  procedure_categories: ["id", "name", "description", "image_url", "sort_order", "created_at"],
  procedures: [
    "id",
    "category_id",
    "name",
    "price",
    "description",
    "sort_order",
    "created_at",
    "image_url",
    "content",
  ],
  specialists: [
    "id",
    "name",
    "position",
    "description",
    "photo_url",
    "sort_order",
    "published",
    "created_at",
    "updated_at",
  ],
  reviews: [
    "id",
    "author_name",
    "text",
    "rating",
    "review_date",
    "published",
    "sort_order",
    "created_at",
    "updated_at",
  ],
  promos: [
    "id",
    "title",
    "description",
    "image_url",
    "starts_at",
    "ends_at",
    "published",
    "sort_order",
    "created_at",
    "updated_at",
  ],
  faq: ["id", "question", "answer", "sort_order", "published", "created_at"],
  interior_photos: ["id", "image_url", "caption", "sort_order", "created_at"],
  clinic_documents: ["id", "title", "file_url", "category", "sort_order", "created_at"],
  consumer_categories: ["id", "name", "sort_order", "created_at"],
  consumer_documents: [
    "id",
    "category_id",
    "title",
    "file_url",
    "content",
    "sort_order",
    "created_at",
  ],
  authorities: ["id", "name", "address", "phone", "email", "website", "sort_order", "created_at"],
  page_content: ["key", "value", "updated_at"],
  requests: [
    "id",
    "name",
    "phone",
    "service",
    "comment",
    "status",
    "source",
    "crm_sent",
    "crm_response",
    "created_at",
    "updated_at",
  ],
} as const;

export type ClinicTable = keyof typeof TABLE_COLUMNS;

export const PUBLIC_READ_TABLES = new Set<ClinicTable>([
  "services",
  "price_files",
  "procedure_categories",
  "procedures",
  "specialists",
  "reviews",
  "promos",
  "faq",
  "interior_photos",
  "clinic_documents",
  "consumer_categories",
  "consumer_documents",
  "authorities",
  "page_content",
]);

const PUBLIC_INSERT_TABLES = new Set<ClinicTable>(["requests"]);

let pool: Pool | undefined;

export function getDbPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not configured");
    }
    pool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
      max: Number(process.env.DATABASE_POOL_MAX || 10),
    });
  }
  return pool;
}

export async function dbQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  return getDbPool().query<T>(text, values);
}

export function canRunPublicDbOperation(operation: DbOperation) {
  const table = asTable(operation.table);
  if (operation.action === "select") return PUBLIC_READ_TABLES.has(table);
  if (operation.action === "insert") return PUBLIC_INSERT_TABLES.has(table);
  return false;
}

export async function runDbOperation(operation: DbOperation) {
  const table = asTable(operation.table);
  switch (operation.action) {
    case "select":
      return formatRows(await selectRows(table, operation), operation);
    case "insert":
      return formatRows(await insertRows(table, operation), operation);
    case "update":
      return formatRows(await updateRows(table, operation), operation);
    case "delete":
      return formatRows(await deleteRows(table, operation), operation);
    case "upsert":
      return formatRows(await upsertRows(table, operation), operation);
    default:
      throw new Error("Unsupported database action");
  }
}

function asTable(value: string): ClinicTable {
  if (!Object.prototype.hasOwnProperty.call(TABLE_COLUMNS, value)) {
    throw new Error(`Table is not allowed: ${value}`);
  }
  return value as ClinicTable;
}

function assertColumn(table: ClinicTable, column: string) {
  if (!(TABLE_COLUMNS[table] as readonly string[]).includes(column)) {
    throw new Error(`Column is not allowed for ${table}: ${column}`);
  }
}

function ident(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function tableIdent(table: ClinicTable) {
  return `public.${ident(table)}`;
}

function parseColumns(table: ClinicTable, columns?: string) {
  if (!columns || columns.trim() === "*") {
    return "*";
  }
  const parsed = columns
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (parsed.length === 0) return "*";
  for (const column of parsed) assertColumn(table, column);
  return parsed.map(ident).join(", ");
}

function sanitizePayload(table: ClinicTable, payload: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    assertColumn(table, key);
    clean[key] = value;
  }
  return clean;
}

function buildWhere(table: ClinicTable, filters: DbFilter[] | undefined, values: unknown[]) {
  if (!filters?.length) return "";
  const clauses = filters.map((filter) => {
    assertColumn(table, filter.column);
    const column = ident(filter.column);
    if (filter.op === "eq") {
      values.push(filter.value);
      return `${column} = $${values.length}`;
    }
    if (filter.op === "neq") {
      values.push(filter.value);
      return `${column} <> $${values.length}`;
    }
    if (filter.op === "not" && filter.operator === "is" && filter.value === null) {
      return `${column} IS NOT NULL`;
    }
    throw new Error(`Unsupported filter: ${filter.op}`);
  });
  return ` WHERE ${clauses.join(" AND ")}`;
}

function buildOrder(table: ClinicTable, orders: DbOrder[] | undefined) {
  if (!orders?.length) return "";
  const clauses = orders.map((order) => {
    assertColumn(table, order.column);
    return `${ident(order.column)} ${order.ascending === false ? "DESC" : "ASC"}`;
  });
  return ` ORDER BY ${clauses.join(", ")}`;
}

function buildLimit(limit: number | undefined, values: unknown[]) {
  if (!Number.isFinite(limit) || !limit || limit < 1) return "";
  values.push(Math.floor(limit));
  return ` LIMIT $${values.length}`;
}

async function selectRows(table: ClinicTable, operation: DbOperation) {
  const values: unknown[] = [];
  const sql =
    `SELECT ${parseColumns(table, operation.columns)} FROM ${tableIdent(table)}` +
    buildWhere(table, operation.filters, values) +
    buildOrder(table, operation.orders) +
    buildLimit(operation.limit, values);
  const result = await dbQuery(sql, values);
  return result.rows;
}

async function insertRows(table: ClinicTable, operation: DbOperation) {
  const payload = Array.isArray(operation.payload) ? operation.payload[0] : operation.payload;
  if (!payload || typeof payload !== "object") throw new Error("Insert payload is required");
  const clean = sanitizePayload(table, payload);
  const keys = Object.keys(clean);
  if (keys.length === 0) throw new Error("Insert payload is empty");
  const values = keys.map((key) => clean[key]);
  const returning = operation.returningColumns
    ? ` RETURNING ${parseColumns(table, operation.returningColumns)}`
    : "";
  const sql = `INSERT INTO ${tableIdent(table)} (${keys.map(ident).join(", ")}) VALUES (${keys
    .map((_, index) => `$${index + 1}`)
    .join(", ")})${returning}`;
  const result = await dbQuery(sql, values);
  return result.rows;
}

async function updateRows(table: ClinicTable, operation: DbOperation) {
  const payload = Array.isArray(operation.payload) ? operation.payload[0] : operation.payload;
  if (!payload || typeof payload !== "object") throw new Error("Update payload is required");
  const clean = sanitizePayload(table, payload);
  const keys = Object.keys(clean);
  if (keys.length === 0) throw new Error("Update payload is empty");
  const values = keys.map((key) => clean[key]);
  const returning = operation.returningColumns
    ? ` RETURNING ${parseColumns(table, operation.returningColumns)}`
    : "";
  const sql =
    `UPDATE ${tableIdent(table)} SET ${keys
      .map((key, index) => `${ident(key)} = $${index + 1}`)
      .join(", ")}` +
    buildWhere(table, operation.filters, values) +
    returning;
  const result = await dbQuery(sql, values);
  return result.rows;
}

async function deleteRows(table: ClinicTable, operation: DbOperation) {
  const values: unknown[] = [];
  const sql = `DELETE FROM ${tableIdent(table)}` + buildWhere(table, operation.filters, values);
  const result = await dbQuery(sql, values);
  return result.rows;
}

async function upsertRows(table: ClinicTable, operation: DbOperation) {
  const conflict = operation.onConflict?.trim();
  if (!conflict) throw new Error("Upsert requires onConflict");
  assertColumn(table, conflict);
  const payload = Array.isArray(operation.payload) ? operation.payload[0] : operation.payload;
  if (!payload || typeof payload !== "object") throw new Error("Upsert payload is required");
  const clean = sanitizePayload(table, payload);
  const keys = Object.keys(clean);
  if (keys.length === 0) throw new Error("Upsert payload is empty");
  const values = keys.map((key) => clean[key]);
  const updateKeys = keys.filter((key) => key !== conflict);
  const returning = operation.returningColumns
    ? ` RETURNING ${parseColumns(table, operation.returningColumns)}`
    : "";
  const sql = `INSERT INTO ${tableIdent(table)} (${keys.map(ident).join(", ")}) VALUES (${keys
    .map((_, index) => `$${index + 1}`)
    .join(", ")}) ON CONFLICT (${ident(conflict)}) DO UPDATE SET ${updateKeys
    .map((key) => `${ident(key)} = EXCLUDED.${ident(key)}`)
    .join(", ")}${returning}`;
  const result = await dbQuery(sql, values);
  return result.rows;
}

function formatRows(rows: QueryResultRow[], operation: DbOperation) {
  if (operation.single || operation.maybeSingle) {
    if (rows.length === 0) {
      if (operation.single) throw new Error("No rows returned");
      return null;
    }
    return rows[0];
  }
  return rows;
}
