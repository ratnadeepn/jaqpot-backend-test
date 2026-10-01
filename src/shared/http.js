import { signBody } from './hmac.js';

export async function postSignedJson({
    url,
    body,
    secret,
    signatureHeader,
}) 
{
    const signature = signBody(body, secret);

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            [signatureHeader]: signature,
        },
        body: JSON.stringify(body),
    });

    let responseBody;
    try {
        responseBody = await response.json();
    } catch {
        responseBody = null;
    }

    if (!response.ok) {
        const error = new Error(
            `Request to ${url} failed with status ${response.status}`
        );
        error.status = response.status;
        error.responseBody = responseBody;
        throw error;
    }

    return responseBody;
}