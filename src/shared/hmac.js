import crypto from 'crypto';

export function signBody(body, secret) {
    const payload = JSON.stringify(body);

    return crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
}

export function verifySignature(providedSignature, body, secret) {
    if (!providedSignature) {
        return false;
    }

    const expectedSignature = signBody(body, secret);

    try{
        const providedBuffer = Buffer.from(providedSignature, 'hex');
        const expectedBuffer = Buffer.from(expectedSignature, 'hex');

        if (providedBuffer.length !== expectedBuffer.length) {
            return false;
        }
        
        /* use constant time comparison instead of normal string equality
         to prevent timing attacks */
        return crypto.timingSafeEqual(providedBuffer, expectedBuffer);

    }
    catch {
        return false;
    }
}