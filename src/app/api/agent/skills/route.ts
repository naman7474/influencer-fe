import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { SKILL_CATALOG } from "@/lib/agent/skills/catalog";
import type { SkillPermission } from "@/lib/agent/skills/types";

/**
 * GET /api/agent/skills
 * Returns all skills with their enabled/disabled status based on agent_config permissions.
 */
export async function GET() {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    const { data: brand } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!brand) {
      return NextResponse.json({ error: "No brand found" }, { status: 404 });
    }

    // Load agent config for permission status
    const { data: config } = await supabase
      .from("agent_config")
      .select("*")
      .eq("brand_id", (brand as { id: string }).id)
      .single();

    const configRecord = (config || {}) as Record<string, unknown>;
    const disabledSkills: string[] = Array.isArray(configRecord.disabled_skills)
      ? (configRecord.disabled_skills as string[])
      : [];

    // Map skills with enabled status (permission-level AND per-skill)
    const skills = SKILL_CATALOG.map((skill) => {
      const permValue = configRecord[skill.permission];
      const permEnabled =
        permValue === undefined || permValue === null
          ? skill.permission === "can_manage_budget"
            ? false
            : true
          : Boolean(permValue);

      // Skill is enabled if permission is on AND skill is not individually disabled
      const enabled = permEnabled && !disabledSkills.includes(skill.name);

      return {
        ...skill,
        enabled,
        permissionEnabled: permEnabled,
        skillDisabled: disabledSkills.includes(skill.name),
      };
    });

    // Gather unique permissions with their status
    const permissions: Record<string, boolean> = {};
    for (const skill of skills) {
      if (!(skill.permission in permissions)) {
        permissions[skill.permission] = skill.permissionEnabled;
      }
    }

    return NextResponse.json({ skills, permissions, disabledSkills });
  } catch {
    return NextResponse.json(
      { error: "Failed to load skills" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agent/skills
 * Toggle a permission on/off.
 */
export async function POST(request: Request) {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    const { data: brand } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!brand) {
      return NextResponse.json({ error: "No brand found" }, { status: 404 });
    }

    const body = await request.json();
    const { permission, enabled } = body as {
      permission: SkillPermission;
      enabled: boolean;
    };

    const { error } = await (
      supabase.from("agent_config") as ReturnType<typeof supabase.from>
    )
      .update({ [permission]: enabled } as never)
      .eq("brand_id", (brand as { id: string }).id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to update permission" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, permission, enabled });
  } catch {
    return NextResponse.json(
      { error: "Failed to update skills" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/agent/skills
 * Toggle an individual skill on/off (adds/removes from disabled_skills array).
 */
export async function PATCH(request: Request) {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    const { data: brand } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!brand) {
      return NextResponse.json({ error: "No brand found" }, { status: 404 });
    }

    const brandId = (brand as { id: string }).id;

    const body = await request.json();
    const { skillName, enabled } = body as {
      skillName: string;
      enabled: boolean;
    };

    // Validate skill name exists in catalog
    const validSkill = SKILL_CATALOG.some((s) => s.name === skillName);
    if (!validSkill) {
      return NextResponse.json(
        { error: `Unknown skill: ${skillName}` },
        { status: 400 }
      );
    }

    // Load current disabled_skills
    const { data: config } = await supabase
      .from("agent_config")
      .select("disabled_skills")
      .eq("brand_id", brandId)
      .single();

    const configRecord = (config || {}) as Record<string, unknown>;
    const currentDisabled: string[] = Array.isArray(configRecord.disabled_skills)
      ? (configRecord.disabled_skills as string[])
      : [];

    // Update the array
    let newDisabled: string[];
    if (enabled) {
      // Remove from disabled list
      newDisabled = currentDisabled.filter((s) => s !== skillName);
    } else {
      // Add to disabled list (if not already there)
      newDisabled = currentDisabled.includes(skillName)
        ? currentDisabled
        : [...currentDisabled, skillName];
    }

    const { error } = await (
      supabase.from("agent_config") as ReturnType<typeof supabase.from>
    )
      .update({ disabled_skills: newDisabled } as never)
      .eq("brand_id", brandId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to update skill" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      skillName,
      enabled,
      disabledSkills: newDisabled,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to toggle skill" },
      { status: 500 }
    );
  }
}
