import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import { createSlugTracker } from "./slug";

export const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
}).use(taskLists, {
  enabled: false,
});

/**
 * Stamp slug `id`s onto every heading so in-document `#fragment` links can scroll
 * to them. Runs as a core rule (after inline parsing) and derives each id from
 * the heading's rendered text via the shared slugger, so the ids match what the
 * link handler computes from `#heading` targets.
 */
markdown.core.ruler.push("heading_anchor_ids", (state) => {
  const uniqueSlug = createSlugTracker();
  const tokens = state.tokens;

  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].type !== "heading_open") {
      continue;
    }

    const inline = tokens[index + 1];
    if (!inline || inline.type !== "inline") {
      continue;
    }

    tokens[index].attrSet("id", uniqueSlug(inline.content));
  }
});
