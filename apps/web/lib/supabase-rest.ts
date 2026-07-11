import https from "https";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
}

type RestInit = RequestInit & {
  query?: Record<string, string | number | boolean | undefined>;
};

export async function supabaseRestRequest(path: string, init: RestInit = {}) {
  const { query, headers, ...requestInit } = init;
  const url = new URL(`${supabaseUrl!.replace(/\/$/, "")}/rest/v1/${path.replace(/^\//, "")}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const normalizedHeaders: Record<string, string> = {
    apikey: supabaseAnonKey!,
    Authorization: `Bearer ${supabaseAnonKey!}`,
    "Content-Type": "application/json",
  };

  if (headers) {
    if (typeof Headers !== "undefined" && headers instanceof Headers) {
      headers.forEach((value, key) => {
        normalizedHeaders[key] = value;
      });
    } else if (Array.isArray(headers)) {
      headers.forEach(([key, value]) => {
        normalizedHeaders[key] = value;
      });
    } else {
      Object.entries(headers).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          normalizedHeaders[key] = String(value);
        }
      });
    }
  }

  const body = typeof requestInit.body === "string" ? requestInit.body : requestInit.body ? JSON.stringify(requestInit.body) : undefined;

  return await new Promise<Response>((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: (requestInit.method || "GET").toUpperCase(),
        headers: normalizedHeaders,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const responseBody = Buffer.concat(chunks).toString("utf8");
          const response = new Response(responseBody, {
            status: res.statusCode || 500,
            headers: {
              "content-type": res.headers["content-type"] || "application/json",
            },
          });

          if ((res.statusCode || 500) >= 200 && (res.statusCode || 500) < 300) {
            resolve(response);
            return;
          }

          reject(new Error(responseBody || `Supabase request failed with ${res.statusCode}`));
        });
      }
    );

    req.on("error", reject);

    if (body) {
      req.write(body);
    }

    req.end();
  });
}
