import { verifySignature } from '../shared/hmac.js';

export function verifyCasinoSignature(req, res, next) {
    const signature = req.header('x-casino-signature');

    const isValid = verifySignature(
        signature, 
        req.body, 
        process.env.CASINO_SECRET
    );

    if (!isValid) {
        return res.status(401).json({ error: 'Invalid casino signature' });
    }

    next();
}


export function verifyProviderSignature(req, res, next) {
    const signature = req.header('x-provider-signature');

    const isValid = verifySignature(
        signature, 
        req.body, 
        process.env.PROVIDER_SECRET
    );

    if (!isValid) {
        return res.status(401).json({ error: 'Invalid provider signature' });
    }
    
    next();
}