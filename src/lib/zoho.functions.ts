import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

interface ZohoTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface ZohoLineItem {
  name: string;
  quantity: number;
  rate: number;
  item_id?: string;
}

interface ZohoInvoice {
  invoice_id: string;
  invoice_number: string;
  status: string;
  date: string;
  line_items?: ZohoLineItem[];
}

interface ZohoPageContext {
  page: number;
  per_page: number;
  has_more_page: boolean;
}

interface ZohoInvoiceListResponse {
  code: number;
  message: string;
  invoices: ZohoInvoice[];
  page_context: ZohoPageContext;
}

interface ZohoInvoiceDetailResponse {
  code: number;
  invoice: ZohoInvoice;
}

export interface SyncResult {
  processed: number;
  skipped: number;
  errors: string[];
  stock_updates: number;
  message?: string;
}

async function getZohoAccessToken(): Promise<string> {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, or ZOHO_REFRESH_TOKEN environment variables",
    );
  }

  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://accounts.zoho.com/oauth/v2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoho OAuth token refresh failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as ZohoTokenResponse;
  if (!data.access_token) {
    throw new Error(`Zoho OAuth response missing access_token: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

async function zohoFetch<T>(
  accessToken: string,
  path: string,
  query?: Record<string, string>,
): Promise<T> {
  const orgId = process.env.ZOHO_ORG_ID;
  if (!orgId) throw new Error("Missing ZOHO_ORG_ID environment variable");

  const url = new URL(`https://www.zohoapis.com/books/v3${path}`);
  url.searchParams.set("organization_id", orgId);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoho Books API error (${res.status}) for ${path}: ${body}`);
  }

  return (await res.json()) as T;
}

async function fetchAllPaidInvoices(accessToken: string): Promise<ZohoInvoice[]> {
  const all: ZohoInvoice[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const data = await zohoFetch<ZohoInvoiceListResponse>("/invoices", {
      status: "paid",
      page: String(page),
      per_page: "200",
    });

    if (data.invoices) all.push(...data.invoices);
    hasMore = data.page_context?.has_more_page ?? false;
    page++;
  }

  return all;
}

async function fetchInvoiceDetails(
  accessToken: string,
  invoiceId: string,
): Promise<ZohoInvoice> {
  const data = await zohoFetch<ZohoInvoiceDetailResponse>(`/invoices/${invoiceId}`);
  return data.invoice;
}

export const syncZohoInvoices = createServerFn({ method: "POST" }).handler(async () => {
  const result: SyncResult = {
    processed: 0,
    skipped: 0,
    errors: [],
    stock_updates: 0,
  };

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

  let accessToken: string;
  try {
    accessToken = await getZohoAccessToken();
  } catch (err) {
    throw new Error(`Zoho token failure: ${err instanceof Error ? err.message : "Unknown error"}`);
  }

  let invoices: ZohoInvoice[];
  try {
    invoices = await fetchAllPaidInvoices(accessToken);
  } catch (err) {
    throw new Error(
      `Zoho API failure fetching invoices: ${err instanceof Error ? err.message : "Unknown error"}`,
    );
  }

  if (!invoices.length) {
    return { ...result, message: "No paid invoices found" };
  }

  const { data: processedRows } = await supabase
    .from("processed_invoices")
    .select("invoice_id");
  const processedSet = new Set((processedRows ?? []).map((r) => r.invoice_id));

  for (const invoice of invoices) {
    if (processedSet.has(invoice.invoice_id)) {
      result.skipped++;
      continue;
    }

    let full: ZohoInvoice;
    try {
      full = await fetchInvoiceDetails(accessToken, invoice.invoice_id);
    } catch (err) {
      result.errors.push(
        `Invoice ${invoice.invoice_number} (${invoice.invoice_id}): detail fetch failed - ${err instanceof Error ? err.message : "Unknown error"}`,
      );
      continue;
    }

    const lineItems = full.line_items ?? [];
    if (!lineItems.length) {
      await supabase.from("processed_invoices").insert({
        invoice_id: invoice.invoice_id,
        status: "skipped",
        error_message: "No line items",
      });
      result.processed++;
      continue;
    }

    let invoiceError = false;
    for (const item of lineItems) {
      if (!item.name || !item.quantity) continue;

      const { data: rpcResult, error: rpcError } = await supabase
        .rpc("reduce_stock", {
          p_product_name: item.name,
          p_qty: item.quantity,
          p_change_type: "SALE",
          p_reference_id: `zoho-invoice-${invoice.invoice_number}`,
        })
        .single<{
          matched: boolean;
          previous_stock: number;
          new_stock: number;
        }>();

      if (rpcError) {
        result.errors.push(
          `Invoice ${invoice.invoice_number}, item "${item.name}": ${rpcError.message}`,
        );
        invoiceError = true;
      } else if (!rpcResult?.matched) {
        result.errors.push(
          `Invoice ${invoice.invoice_number}, item "${item.name}": product not found in inventory`,
        );
        invoiceError = true;
      } else {
        result.stock_updates++;
      }
    }

    await supabase.from("processed_invoices").insert({
      invoice_id: invoice.invoice_id,
      status: invoiceError ? "partial" : "success",
      error_message: invoiceError ? "Some items had errors" : null,
    });
    result.processed++;
  }

  return result;
});

export const getZohoSyncStatus = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return { total: 0, lastSync: null, recentErrors: 0 };
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

  const { count } = await supabase
    .from("processed_invoices")
    .select("*", { count: "exact", head: true });

  const { data: lastRow } = await supabase
    .from("processed_invoices")
    .select("processed_at, status")
    .order("processed_at", { ascending: false })
    .limit(1);

  const { count: errorCount } = await supabase
    .from("processed_invoices")
    .select("*", { count: "exact", head: true })
    .neq("status", "success");

  return {
    total: count ?? 0,
    lastSync: lastRow?.[0]?.processed_at ?? null,
    recentErrors: errorCount ?? 0,
  };
});
