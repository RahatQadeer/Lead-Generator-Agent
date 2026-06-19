"use server";

import { revalidatePath } from "next/cache";
import { deleteContactsByIds, deleteAllUserLeads } from "@/lib/contacts/queries";
import { getAuthContext } from "@/lib/auth/get-auth-context";

export type LeadActionResult =
  | { success: true; deletedCount: number }
  | { success: false; error: string };

export async function deleteLeads(contactIds: string[]): Promise<LeadActionResult> {
  if (contactIds.length === 0) {
    return { success: false, error: "No leads selected." };
  }

  try {
    const { user } = await getAuthContext();
    const deletedCount = await deleteContactsByIds(user.id, contactIds);
    revalidatePath("/leads");
    revalidatePath("/dashboard");
    return { success: true, deletedCount };
  } catch {
    return { success: false, error: "Failed to delete leads." };
  }
}

export async function deleteAllLeads(): Promise<LeadActionResult> {
  try {
    const { user } = await getAuthContext();
    const deletedCount = await deleteAllUserLeads(user.id);
    revalidatePath("/leads");
    revalidatePath("/dashboard");
    return { success: true, deletedCount };
  } catch {
    return { success: false, error: "Failed to delete all leads." };
  }
}
