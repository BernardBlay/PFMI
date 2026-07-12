import https from "https";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "placeholder-key";

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
        timeout: 30000, // 30s timeout
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

          // Always resolve so callers can check response.ok / response.status
          resolve(response);
        });
        res.on("error", (err) => {
          // Handle response stream errors (ECONNRESET during read)
          const errorResponse = new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
          resolve(errorResponse);
        });
      }
    );

    req.on("error", (err) => {
      // Handle request errors (connection refused, DNS, etc)
      const errorResponse = new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
      resolve(errorResponse);
    });

    req.on("timeout", () => {
      req.destroy();
      const errorResponse = new Response(JSON.stringify({ error: "Request timeout" }), {
        status: 504,
        headers: { "content-type": "application/json" },
      });
      resolve(errorResponse);
    });

    if (body) {
      req.write(body);
    }

    req.end();
  });
}
