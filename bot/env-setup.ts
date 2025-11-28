import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the root .env file
// We use path.resolve to ensure we find the file relative to this script
dotenv.config({ path: path.resolve(__dirname, '../.env') });

console.log('✅ Environment variables loaded from root .env');
