"use client";

import { useEffect, useState } from "react";
import { GUIDE_CAPTURE_ANCHOR } from "@/lib/site";

/**
 * Sticky call to action for the bottom of the screen on `/guide`, phones only.
 *
 * The page runs to roughly nine screens on a phone. Without this, someone who
 * scrolls past the hero form and then loses interest halfway down has nothing to
 * act on — the next form is thousands of pixels away in either direction.
 *
 * It hides itself whenever a capture form is actually on screen. A bar that
 * covers the form it is pointing at is worse than no bar: on a short viewport it
 * can sit directly over the submit button. So it watches both forms and only
 * appears when neither is visible.
 *
 * Phones only (`sm:hidden`). On a desktop viewport the hero form is large, the
 * page is far shorter in screens, and a fixed bar would just be chrome.
 */
export function StickyGuideCta({
  label,
  watchIds,
}: {
  label: string;
  /**
   * Ids of the capture forms themselves — not the sections wrapping them. The
   * threshold below is a fraction of the observed element, so an element taller
   * than the viewport can never satisfy it, and a section that grows by a couple
   * of paragraphs would quietly start letting the bar sit over its own form.
   */
  watchIds: string[];
}) {
  const [visible, setVisible] = useState(false);

  // Depend on the contents rather than the array, which is a fresh reference on
  // every render and would otherwise tear down the observer each time.
  const watchKey = watchIds.join(",");

  useEffect(() => {
    const targets = watchKey
      .split(",")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (targets.length === 0) return;

    // Tracked per element: with one shared flag, whichever form reported last
    // would win, and scrolling out of one form into another would leave the bar
    // in whatever state the stale callback set.
    const onScreen = new Set<Element>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) onScreen.add(entry.target);
          else onScreen.delete(entry.target);
        }
        setVisible(onScreen.size === 0);
      },
      // A form counts as on screen once a quarter of it is showing, and the
      // bottom margin keeps it "on screen" while it sits behind the bar itself.
      { threshold: 0.25, rootMargin: "0px 0px -80px 0px" }
    );

    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, [watchKey]);

  return (
    <div
      // Never focusable while hidden — a keyboard user tabbing down the page
      // should not land on a control nobody can see.
      inert={!visible}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-[#33332f] bg-[#1b1b1b]/97 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur transition-transform duration-200 sm:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <a
        href={GUIDE_CAPTURE_ANCHOR}
        className="flex w-full items-center justify-center rounded-lg bg-[#f6be00] px-6 py-3.5 text-base font-bold text-[#1b1b1b] transition-colors hover:bg-[#ffd23d]"
      >
        {label}
      </a>
    </div>
  );
}
