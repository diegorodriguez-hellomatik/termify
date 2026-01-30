#!/usr/bin/env npx ts-node
/**
 * Generate VAPID keys for Web Push Notifications
 *
 * Run: npx ts-node scripts/generate-vapid-keys.ts
 *
 * Then add the output to your .env file
 */

import webpush from 'web-push';

const vapidKeys = webpush.generateVAPIDKeys();

console.log('\n=== VAPID Keys Generated ===\n');
console.log('Add these to your .env file:\n');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:notifications@termify.app`);
console.log('\n=== End of Keys ===\n');
