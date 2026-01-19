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

function b64bin(buf) {
  return Buffer.from(buf).toString("base64");
}

function yamlSingleQuote(s) {
  return `'${String(s ?? "").replace(/'/g, "''")}'`;
}

function yamlBlock(s) {
  const text = String(s ?? "").replace(/\r\n/g, "\n");
  const lines = text.split("\n").map((line) => `  ${line}`);
  return `|\n${lines.join("\n")}`;
}

function isHttpUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === "http:" || x.protocol === "https:";
  } catch {
    return false;
  }
}

function parseDataUrl(dataUrl) {
  // data:image/png;base64,AAAA
  const m = /^data:(.+);base64,(.+)$/.exec(dataUrl || "");
  if (!m) return null;
  return { contentType: m[1], base64: m[2] };
}

async function putGithubFile({ owner, repo, path, message, contentBase64, token, branch }) {
  const api = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const res = await fetch(api, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "netlify-function",
      Accept: "application/vnd.github+json",
    },
    body: JSON.stringify({
      message,
      content: contentBase64,
      branch,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt);
  }
}

export async function handler(event) {
  try {
    const body = JSON.parse(event.body || "{}");

    const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
    if (!ADMIN_TOKEN || body.token !== ADMIN_TOKEN) {
      return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    }

    const { title, date, summary, url, image } = body;

    if (!title || !date || !summary || !url || !image?.dataUrl) {
      return { statusCode: 400, body: JSON.stringify({ error: "필수 항목(제목/날짜/요약/링크/이미지)을 모두 입력해주세요." }) };
    }

    if (!isHttpUrl(url)) {
      return { statusCode: 400, body: JSON.stringify({ error: "이동 링크는 http/https로 시작해야 합니다." }) };
    }

    const parsed = parseDataUrl(image.dataUrl);
    if (!parsed) {
      return { statusCode: 400, body: JSON.stringify({ error: "이미지 데이터가 올바르지 않습니다." }) };
    }

    const ct = parsed.contentType;
    const isJpg = ct === "image/jpeg";
    const isPng = ct === "image/png";
    if (!isJpg && !isPng) {
      return { statusCode: 400, body: JSON.stringify({ error: "JPG 또는 PNG만 가능합니다." }) };
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_OWNER = process.env.GITHUB_OWNER;
    const GITHUB_REPO = process.env.GITHUB_REPO;
    const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";

    if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
      return { statusCode: 500, body: JSON.stringify({ error: "Server env missing (GITHUB_TOKEN/OWNER/REPO)" }) };
    }

    // 파일명 생성(안전)
    const slug = slugify(title);
    const ext = isPng ? "png" : "jpg";
    const imgName = `${date}-${slug}-${Date.now()}.${ext}`;
    const imgPath = `public/uploads/newsletter/${imgName}`;
    const thumbnailPathForSite = `/uploads/newsletter/${imgName}`;

    // md 파일 생성(안전 YAML)
    const mdFile = `${date}-${slug}.md`;
    const mdPath = `src/content/newsletter/${mdFile}`;

    const md =
`---
title: ${yamlSingleQuote(title)}
date: ${date}
summary: ${yamlBlock(summary)}
thumbnail: ${yamlSingleQuote(thumbnailPathForSite)}
url: ${yamlSingleQuote(url)}
---
`;

    // 1) 이미지 커밋
    await putGithubFile({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: imgPath,
      message: `Add newsletter image: ${imgName}`,
      contentBase64: parsed.base64,
      token: GITHUB_TOKEN,
      branch: GITHUB_BRANCH,
    });

    // 2) md 커밋
    await putGithubFile({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: mdPath,
      message: `Add newsletter: ${title}`,
      contentBase64: b64(md),
      token: GITHUB_TOKEN,
      branch: GITHUB_BRANCH,
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true, mdPath, imgPath }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e?.message || e) }) };
  }
}
