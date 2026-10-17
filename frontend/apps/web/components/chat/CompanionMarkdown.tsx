"use client";

import { memo } from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import styles from "./CompanionMarkdown.module.css";

/** Same renderer as the main app, sized for the floating conversation.
 * The caller owns its EXISTING stream cursor; no duplicate/new spark animation.
 */
export const CompanionMarkdown = memo(function CompanionMarkdown({
  content, isStreaming = false,
}: { content?: string | null; isStreaming?: boolean }) {
  return (
    <div className={styles.content}>
      <MarkdownRenderer content={content} isStreaming={isStreaming} showCursor={false} />
    </div>
  );
});
