import test from 'node:test';
import assert from 'node:assert/strict';
import {X509Certificate} from 'node:crypto';
import {postgresConfig} from '../server/postgres-config.js';

test('Supabase pooler uses its trusted CA and cannot disable certificate verification through URL flags',()=>{
 const options=postgresConfig('postgresql://user:password@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=no-verify&sslrootcert=bad');
 assert.equal(options.ssl.rejectUnauthorized,true);
 assert.equal(new X509Certificate(options.ssl.ca).ca,true);
 assert.equal(new URL(options.connectionString).search,'');
 assert.equal(new URL(options.connectionString).port,'6543');
});
test('Non-Supabase connections retain their configured TLS settings',()=>{
 const connectionString='postgresql://user:password@localhost:5432/postgres?sslmode=require';
 assert.deepEqual(postgresConfig(connectionString),{connectionString});
});
