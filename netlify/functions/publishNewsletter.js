function slugify(s) {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

function b64(str) {
  return Buffer.from(str, "utf8").toString("base64");
}

export async function handler(event) {
  try {
    const body = JSON.parse(event.body || "{}");

    const {
      token,
      title,
      date,
      summary,
      thumbnail,
      url,
    } = body;

    const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
    if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
      return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    }

    if (!title || !date || !summary || !thumbnail || !url) {
      return { statusCode: 400, body: JSON.stringify({ error: "필수 항목(제목/날짜/요약/썸네일URL/링크)을 모두 입력해주세요." }) };
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_OWNER = process.env.GITHUB_OWNER;
    const GITHUB_REPO = process.env.GITHUB_REPO;
    const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";

    if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
      return { statusCode: 500, body: JSON.stringify({ error: "Server env missing (GITHUB_TOKEN/OWNER/REPO)" }) };
    }

    const slug = slugify(title);
    const filename = `${date}-${slug}.md`;
    const path = `src/content/newsletter/${filename}`;

    // YAML은 따옴표/이스케이프 문제 방지 위해 단순하게
    const md = `---
title: ${title}
date: ${date}
summary: ${summary}
thumbnail: ${thumbnail}
url: ${url}
---
`;

    const api = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(path)}`;

    const res = await fetch(api, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "netlify-function",
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify({
        message: `Add newsletter: ${title}`,
        content: b64(md),
        branch: GITHUB_BRANCH,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return { statusCode: 500, body: JSON.stringify({ error: `GitHub commit failed: ${txt}` }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, path }) };
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Bad request" }) };
  }
}
