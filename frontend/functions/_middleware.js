export const onRequest = async ({ request, next }) => {
    const header = request.headers.get("Authorization");
    if (!header || !isAllowed(header)) {
        return new Response("Autenticación requerida", {
            status: 401,
            headers: { "WWW-Authenticate": 'Basic realm="Privado grupo6"' },
        });
    }
    return next();
};

function isAllowed(header) {
    const [scheme, encoded] = header.split(" ");
    if (scheme !== "Basic" || !encoded) return false;
    const decoded = atob(encoded);
    const i = decoded.indexOf(":");
    if (i < 0) return false;
    const user = decoded.slice(0, i);
    const pass = decoded.slice(i + 1);
    return user === "grupo6" && pass === "Grupo62025";
}
