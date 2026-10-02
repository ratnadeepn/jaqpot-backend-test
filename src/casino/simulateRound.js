import { launchGame } from "./launchGame.js";
import { postSignedJson } from "../shared/http.js";

export async function simulateRound({ userId, gameId, currencyCode }) {
    /* launch the game normally to create:
    1. casino session
    2. provider session
    */
    const launchResponse = await launchGame({
        userId,
        gameId,
        currencyCode,
    });
    
    // ask provider to run the scripted simulation
    const providerSimulation = await postSignedJson({
        url: `${process.env.BASE_URL}/provider/simulate`,
        body: {
            casinoSessionToken: launchResponse.casinoSessionToken,
            providerSessionId: launchResponse.providerSessionId,
        },
        secret: process.env.PROVIDER_SECRET,
        signatureHeader: "x-provider-signature",
    });
    
    return {
        success: true,
        launch: launchResponse,
        simulation: providerSimulation,
    };
}