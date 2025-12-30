import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from '../config/database';
import path from 'path';

async function runMigrations() {
  try {
    console.log('🔄 Running migrations...');
    const migrationsFolder = path.join(process.cwd(), 'drizzle');
    console.log(`📁 Migrations folder: ${migrationsFolder}`);
    
    await migrate(db, { migrationsFolder });
    console.log('✅ Migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();

