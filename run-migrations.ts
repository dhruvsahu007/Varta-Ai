import { config as loadEnv } from "dotenv";
loadEnv();

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from './shared/schema';

async function runMigrations() {
  try {
    console.log('🔗 Connecting to PostgreSQL database for migrations...');
    
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL environment variable is not set!');
      console.log('');
      console.log('Please set your DATABASE_URL in a .env file:');
      console.log('DATABASE_URL=postgresql://username:password@your-rds-endpoint:5432/database_name');
      process.exit(1);
    }
    
    console.log('📝 Database URL:', process.env.DATABASE_URL.replace(/\/\/.*@/, '//***:***@'));
    
    // Create connection for migrations with SSL support
    const migrationClient = postgres(process.env.DATABASE_URL!, { 
      ssl: {
        rejectUnauthorized: false // Required for most managed databases
      },
      max: 1, // Use only 1 connection for migrations
      onnotice: () => {}, // Suppress notices during migration
      transform: undefined, // Disable automatic transformations
    });
    
    console.log('🗄️  Creating Drizzle instance...');
    const db = drizzle(migrationClient, { schema });
    
    console.log('🚀 Running migrations...');
    await migrate(db, { migrationsFolder: './migrations' });
    
    console.log('✅ Migrations completed successfully!');
    
    // Test a simple query to verify everything is working
    console.log('🧪 Testing database connection...');
    const result = await migrationClient`SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public'`;
    console.log(`📊 Found ${result[0].table_count} tables in the database`);
    
    // Close the connection
    await migrationClient.end();
    
    console.log('🎉 All done! Your PostgreSQL database is ready.');
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    
    if (error.message.includes('password authentication failed')) {
      console.log('');
      console.log('🔐 Please check your DATABASE_URL credentials:');
      console.log('- Username and password are correct');
      console.log('- User has CREATE and ALTER permissions on the database');
    } else if (error.message.includes('database') && error.message.includes('does not exist')) {
      console.log('');
      console.log('🗄️  Database does not exist. Please:');
      console.log('- Create the database first');
      console.log('- Or update DATABASE_URL to point to an existing database');
    } else if (error.message.includes('connect') || error.message.includes('timeout')) {
      console.log('');
      console.log('🌐 Connection issue:');
      console.log('- Check if the database server is accessible');
      console.log('- Verify firewall/security group settings');
    }
    
    process.exit(1);
  }
}

runMigrations();
