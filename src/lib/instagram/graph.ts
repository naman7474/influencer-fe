export const GRAPH_BASE = "https://graph.facebook.com/v21.0";
export const GRAPH_INSTAGRAM_BASE = "https://graph.instagram.com/v21.0";

export type GraphResponse<T> = T & { error?: GraphError };

export type GraphError = {
  message: string;
  type?: string;
  code?: number;
  fbtrace_id?: string;
};

export class GraphApiError extends Error {
  constructor(public status: number, public graph: GraphError) {
    super(graph.message);
    this.name = "GraphApiError";
  }
}

export async function graphGet<T = unknown>(
  path: string,
  params: Record<string, string>,
  opts: { base?: string } = {}
): Promise<T> {
  const base = opts.base ?? GRAPH_BASE;
  const url = `${base}${path}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, { method: "GET" });
  const json = (await res.json()) as GraphResponse<T>;
  if (!res.ok || json.error) {
    throw new GraphApiError(res.status, json.error ?? { message: "graph_get_failed" });
  }
  return json as T;
}

export async function graphPost<T = unknown>(
  path: string,
  body: Record<string, unknown>,
  accessToken: string,
  opts: { base?: string } = {}
): Promise<T> {
  const base = opts.base ?? GRAPH_BASE;
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as GraphResponse<T>;
  if (!res.ok || json.error) {
    throw new GraphApiError(res.status, json.error ?? { message: "graph_post_failed" });
  }
  return json as T;
}
