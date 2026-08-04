/**
 * Pre-sync data repair.
 *
 * The schema evolved (free-text vendor/currency names became foreign keys), but
 * existing rows still hold legacy values — vendor names, deleted ids, empty
 * strings. When TypeORM `synchronize` tries to add the FK it fails with:
 *
 *   Cannot add or update a child row: a foreign key constraint fails
 *   (`erp_db`.`#sql-...`, CONSTRAINT `FK_...` FOREIGN KEY (`vendor_id`) ...)
 *
 * This module runs BEFORE Nest boots and nulls out only the orphan references
 * (values that point at a row which does not exist). No business data is
 * deleted — rows are preserved, only the dangling pointer is cleared.
 */
import * as mysql from 'mysql2/promise';

type Ref = {
  table: string;
  column: string;
  refTable: string;
  refColumn?: string;
  /** When the column is NOT NULL in the new schema, orphan rows can't be nulled. */
  nullable?: boolean;
};

/** Every FK relation declared across the entities. */
export const FK_REFS: Ref[] = [
  // products
  { table: 'products', column: 'department_id', refTable: 'departments' },
  { table: 'products', column: 'base_uom_id', refTable: 'uoms' },
  { table: 'products', column: 'weight_uom_id', refTable: 'uoms' },
  { table: 'products', column: 'buying_currency_id', refTable: 'currencies' },
  { table: 'products', column: 'selling_currency_id', refTable: 'currencies' },
  // stock
  { table: 'product_stock', column: 'product_id', refTable: 'products' },
  { table: 'product_stock', column: 'vendor_id', refTable: 'vendors' },
  { table: 'product_stock', column: 'qty_uom_id', refTable: 'uoms' },
  { table: 'product_stock', column: 'buying_currency_id_snapshot', refTable: 'currencies' },
  { table: 'product_stock', column: 'selling_currency_id_snapshot', refTable: 'currencies' },
  { table: 'stock_documents', column: 'stock_id', refTable: 'product_stock' },
  { table: 'stock_documents', column: 'currency_id', refTable: 'currencies' },
  { table: 'stock_attachments', column: 'stock_id', refTable: 'product_stock' },
  { table: 'stock_attachments', column: 'stock_document_id', refTable: 'stock_documents' },
  { table: 'stock_history', column: 'stock_id', refTable: 'product_stock' },
  { table: 'product_history', column: 'product_id', refTable: 'products' },
  // partners
  { table: 'vendors', column: 'currency_id', refTable: 'currencies' },
  { table: 'vendor_documents', column: 'vendor_id', refTable: 'vendors' },
  { table: 'customers', column: 'currency_id', refTable: 'currencies' },
  { table: 'customer_documents', column: 'customer_id', refTable: 'customers' },
  // users / hr
  { table: 'users', column: 'role_id', refTable: 'roles' },
  { table: 'employee_profiles', column: 'user_id', refTable: 'users' },
  { table: 'employee_profiles', column: 'department_id', refTable: 'departments' },
  { table: 'employee_profiles', column: 'salary_currency_id', refTable: 'currencies' },
  { table: 'employee_documents', column: 'employee_id', refTable: 'employee_profiles' },
  { table: 'employee_attendance', column: 'employee_id', refTable: 'employee_profiles' },
  { table: 'employee_payslips', column: 'employee_id', refTable: 'employee_profiles' },
  { table: 'employee_payslips', column: 'currency_id', refTable: 'currencies' },
];

async function tableExists(conn: mysql.Connection, db: string, table: string) {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    'SELECT 1 FROM information_schema.tables WHERE table_schema = ? AND table_name = ? LIMIT 1',
    [db, table],
  );
  return rows.length > 0;
}

async function columnExists(conn: mysql.Connection, db: string, table: string, column: string) {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    'SELECT 1 FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ? LIMIT 1',
    [db, table, column],
  );
  return rows.length > 0;
}

/**
 * Clears dangling foreign-key values so `synchronize` can create the constraints
 * against legacy data. Safe to run on every boot — it is a no-op once clean.
 */
export async function repairOrphanForeignKeys(log: (m: string) => void = console.log) {
  const database = process.env.DB_DATABASE ?? process.env.DB_NAME;
  if (!database) return;

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USERNAME ?? process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database,
    multipleStatements: false,
  });

  try {
    let repaired = 0;
    for (const ref of FK_REFS) {
      const refColumn = ref.refColumn ?? 'id';
      if (!(await tableExists(conn, database, ref.table))) continue;
      if (!(await tableExists(conn, database, ref.refTable))) continue;
      if (!(await columnExists(conn, database, ref.table, ref.column))) continue;

      // Empty strings are legacy placeholders and can never match a uuid PK.
      const [res] = await conn.execute<mysql.ResultSetHeader>(
        `UPDATE \`${ref.table}\` c
            LEFT JOIN \`${ref.refTable}\` p ON p.\`${refColumn}\` = c.\`${ref.column}\`
            SET c.\`${ref.column}\` = NULL
          WHERE c.\`${ref.column}\` IS NOT NULL
            AND (c.\`${ref.column}\` = '' OR p.\`${refColumn}\` IS NULL)`,
      );
      if (res.affectedRows > 0) {
        repaired += res.affectedRows;
        log(
          `[db-repair] ${ref.table}.${ref.column}: cleared ${res.affectedRows} orphan reference(s) to ${ref.refTable}`,
        );
      }
    }
    if (repaired === 0) log('[db-repair] no orphan foreign keys found');
  } finally {
    await conn.end();
  }
}
