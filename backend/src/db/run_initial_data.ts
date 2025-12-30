import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { hashPassword } from '../utils/password.util';
import { locations, rooms, users } from './schema';
import { eq } from 'drizzle-orm';
import { db } from '../config/database';

dotenv.config();

async function runInitialDataMigration() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  try {
    console.log('🔄 Running initial data migration...');
    console.log('📡 Testing database connection...');

    // Test connection
    const testPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    await testPool.query('SELECT NOW()');
    await testPool.end();
    console.log('✅ Database connected successfully');

    // Check if data already exists
    const existingLocations = await db.query.locations.findMany();
    if (existingLocations.length > 0) {
      console.log('⚠️  Initial data already exists. Skipping migration.');
      process.exit(0);
    }

    // Create locations
    console.log('📍 Creating locations...');
    const [pimlico] = await db
      .insert(locations)
      .values({
        name: 'Pimlico',
        roomCount: '4',
      })
      .returning();

    const [kensington] = await db
      .insert(locations)
      .values({
        name: 'Kensington',
        roomCount: '6',
      })
      .returning();

    console.log('✅ Locations created');

    // Create rooms for Pimlico
    console.log('🚪 Creating rooms for Pimlico...');
    for (let i = 1; i <= 4; i++) {
      await db.insert(rooms).values({
        locationId: pimlico.id,
        name: `Pimlico Room ${i}`,
        roomNumber: i.toString(),
        active: true,
      });
    }

    // Create rooms for Kensington
    console.log('🚪 Creating rooms for Kensington...');
    for (let i = 1; i <= 6; i++) {
      await db.insert(rooms).values({
        locationId: kensington.id,
        name: `Kensington Room ${i}`,
        roomNumber: i.toString(),
        active: true,
      });
    }

    console.log('✅ Rooms created');

    // Create dummy user "Rober Assogioli"
    console.log('👤 Creating dummy user...');
    const dummyPasswordHash = await hashPassword('dummy-password-change-me');
    await db.insert(users).values({
      email: 'rober.assogioli@therapport.co.uk',
      passwordHash: dummyPasswordHash,
      firstName: 'Rober',
      lastName: 'Assogioli',
      role: 'practitioner',
    });

    console.log('✅ Dummy user created');

    // Create admin user
    console.log('👤 Creating admin user...');
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminPasswordHash = await hashPassword(adminPassword);
    await db.insert(users).values({
      email: 'info@therapport.co.uk',
      passwordHash: adminPasswordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
    });

    console.log('✅ Admin user created');
    console.log('✅ Initial data migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Initial data migration failed:', error);
    process.exit(1);
  }
}

runInitialDataMigration();
