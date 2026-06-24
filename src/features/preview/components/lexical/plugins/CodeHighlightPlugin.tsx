/**
 * Registers highlight.js-driven syntax highlighting on the editor's code blocks.
 *
 * `registerCodeHighlighting` installs node transforms that keep every `CodeNode`
 * tokenised as the user types, swapping its children for the `CodeHighlightNode`s
 * produced by `hljsTokenizer`. We pass our highlight.js tokenizer (instead of the
 * default Prism one) so the editor matches the markdown-it preview exactly.
 */
import { registerCodeHighlighting } from "@lexical/code";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";
import { hljsTokenizer } from "../hljsTokenizer";

export default function CodeHighlightPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return registerCodeHighlighting(editor, hljsTokenizer);
  }, [editor]);

  return null;
}
