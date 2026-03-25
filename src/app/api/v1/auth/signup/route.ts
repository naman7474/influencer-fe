import { apiError, apiOk } from "@/lib/api";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      user_id?: string;
      brand_name?: string;
      email?: string;
    };

    if (!body.user_id || !body.email) {
      return apiError(400, {
        code: "validation_error",
        message: "user_id and email are required.",
      });
    }

    const serviceRole = createServiceRoleClient();
    const fallbackBrandName =
      body.brand_name?.trim() || body.email.split("@")[0] || "New brand";

    const { data: existingUser, error: userError } =
      await serviceRole.auth.admin.getUserById(body.user_id);

    if (userError || !existingUser.user) {
      return apiError(404, {
        code: "auth_user_not_found",
        message: "Auth user was not found in Supabase Auth.",
      });
    }

    const { data, error } = await serviceRole
      .from("brands")
      .upsert(
        {
          auth_user_id: body.user_id,
          brand_name: fallbackBrandName,
        },
        { onConflict: "auth_user_id" }
      )
      .select("id, auth_user_id, brand_name")
      .single();

    if (error) {
      throw error;
    }

    return apiOk({ brand: data }, undefined, 201);
  } catch (error) {
    return apiError(500, {
      code: "brand_signup_bootstrap_failed",
      message:
        error instanceof Error
          ? error.message
          : "Unable to bootstrap brand signup.",
    });
  }
}
