/**
 * Shared between the reset panel and the action behind it.
 *
 * In its own file because a `"use server"` module may only export async
 * functions — a plain constant exported from actions.ts fails the build, though
 * not the type check, so it is the sort of thing that gets found late.
 *
 * A phrase rather than a word: this deletes rows, and the extra deliberateness
 * of typing two words is the entire point of a confirmation.
 */
export const CLICK_RESET_CONFIRMATION = "RESET CLICKS";
