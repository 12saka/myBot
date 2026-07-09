import * as crypto from 'crypto';

export interface SignedHeaders {
  'X-Signature': string;
  'X-Timestamp': string;
}

/**
 * Generates an HMAC-SHA256 signature for outgoing HTTP payloads directed at the AI service.
 * Signature payload format: timestamp + "." + JSON.stringify(body)
 */
export function generateHmacSignature(body: any, secret: string): SignedHeaders {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const serializedBody = JSON.stringify(body);
  const payload = `${timestamp}.${serializedBody}`;
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return {
    'X-Signature': signature,
    'X-Timestamp': timestamp,
  };
}
