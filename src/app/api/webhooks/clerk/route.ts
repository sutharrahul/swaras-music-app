import { ApiResponse } from '@/app/utils/ApiResponse';
import { verifyWebhook } from '@clerk/nextjs/webhooks';
import { NextRequest } from 'next/server';
import handleUpdateUser from './handlers/handleUserUpdated';
import handleUserCreated from './handlers/handleUserCreated';

export async function POST(req: NextRequest) {
  try {
    console.log('Clerk Webhook Route Invoked');
    console.log('Received webhook request from Clerk', req);
    const event = await verifyWebhook(req);

    const { id } = event.data as any;

    const eventType = event.type;

    if (!id || !eventType) {
      return ApiResponse.error('Invalid webhook payload', 400);
    }

    // Handle different event types

    switch (event.type) {
      case 'user.created':
        // Handle user created event
        console.log('Handle user created event');
        await handleUserCreated(event.data);
        break;
      case 'user.updated':
        // Handle user updated event
        console.log('Handle user updated event');
        await handleUpdateUser(event.data);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return ApiResponse.success('Webhook processed successfully');
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return ApiResponse.error('Failed to verify webhook', 400);
  }
}
