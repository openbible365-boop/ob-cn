import { NextResponse } from "next/server";
import {
  DEFAULT_SHARE_CARD_TEMPLATE,
  resolveShareCardTemplate,
  SHARE_CARD_TEMPLATES,
} from "@/lib/share-card-templates";
import { getShareCardSettings } from "@/lib/share-card-settings-store";

export async function GET() {
  try {
    const settings = await getShareCardSettings();
    return NextResponse.json(
      {
        ok: true,
        activeTemplate: resolveShareCardTemplate(settings),
        configuredTemplate: settings.activeTemplate,
        autoRotate: settings.autoRotate,
        rotationDays: settings.rotationDays,
        templates: SHARE_CARD_TEMPLATES,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        ok: true,
        activeTemplate: DEFAULT_SHARE_CARD_TEMPLATE,
        configuredTemplate: DEFAULT_SHARE_CARD_TEMPLATE,
        autoRotate: false,
        rotationDays: 7,
        templates: SHARE_CARD_TEMPLATES,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
