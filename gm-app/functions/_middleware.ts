const COOKIE_NAME = "gm_device";

interface Env {
  GM_DEVICE_TOKEN?: string;
}

export const onRequest: PagesFunction<Env> = async ({ request, next, env }) => {
  const deviceToken = env.GM_DEVICE_TOKEN;
  if (!deviceToken) {
    return next();
  }

  const url = new URL(request.url);

  if (url.pathname === "/_activate") {
    const token = url.searchParams.get("token");
    if (token !== deviceToken) {
      return new Response("Invalid token", { status: 403 });
    }
    return new Response("Device activated. You can now use the GM app.", {
      status: 200,
      headers: {
        "Set-Cookie": `${COOKIE_NAME}=${deviceToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=315360000`,
        "Content-Type": "text/plain",
      },
    });
  }

  const cookies = request.headers.get("Cookie") || "";
  const hasToken = cookies.split(";").some(
    (c) => c.trim() === `${COOKIE_NAME}=${deviceToken}`
  );

  if (!hasToken) {
    return new Response("Access denied", { status: 403 });
  }

  return next();
};
