export const onRequestPost = async ({ request }) => {
    const headers = new Headers({
        "Set-Cookie": `session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
        "Location": "/login"
    });
    return new Response(null, { status: 302, headers });
};
