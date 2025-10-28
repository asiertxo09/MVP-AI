import { serializeSessionClearCookie } from "../lib/session";

export const onRequestPost = async () => {
    const headers = new Headers({
        "Set-Cookie": serializeSessionClearCookie(),
        "Cache-Control": "no-store",
        "Content-Type": "application/json"
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};
