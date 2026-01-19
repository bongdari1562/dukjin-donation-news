export async function handler(event) {
  try {
    const body = JSON.parse(event.body || "{}");

    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    const ADMIN_TOKEN = process.env.ADMIN_TOKEN; // 임의의 긴 문자열(토큰)

    if (!ADMIN_PASSWORD || !ADMIN_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Server env missing (ADMIN_PASSWORD/ADMIN_TOKEN)" }),
      };
    }

    // 토큰 검증 모드
    if (body.token) {
      if (body.token === ADMIN_TOKEN) {
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
      }
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid token" }) };
    }

    // 비밀번호 로그인 모드
    if (body.password === ADMIN_PASSWORD) {
      return { statusCode: 200, body: JSON.stringify({ token: ADMIN_TOKEN }) };
    }

    return { statusCode: 401, body: JSON.stringify({ error: "비밀번호가 틀렸습니다." }) };
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Bad request" }) };
  }
}
