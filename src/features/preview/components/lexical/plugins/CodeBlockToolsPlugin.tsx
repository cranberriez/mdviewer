/**
 * Code block tools. Shows a small control row (language selector + copy button)
 * at the top-right of the code block the caret is currently inside. Lean custom
 * implementation; avoids @lexical/code-prism helpers (not installed) by using a
 * fixed language list and CodeNode.setLanguage directly.
 */
import { $isCodeNode } from "@lexical/code";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";
import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
  type LexicalEditor,
  type NodeKey,
} from "lexical";
import { Copy } from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
  type JSX,
} from "react";
import { createPortal } from "react-dom";

// A pragmatic subset that lines up with highlight.js's common bundle used in the
// preview. `text` clears highlighting.
const LANGUAGES: Array<{ value: string; label: string }> = [
  { value: "text", label: "Plain text" },
  { value: "bash", label: "Bash" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "css", label: "CSS" },
  { value: "diff", label: "Diff" },
  { value: "go", label: "Go" },
  { value: "html", label: "HTML" },
  { value: "java", label: "Java" },
  { value: "javascript", label: "JavaScript" },
  { value: "json", label: "JSON" },
  { value: "kotlin", label: "Kotlin" },
  { value: "markdown", label: "Markdown" },
  { value: "php", label: "PHP" },
  { value: "python", label: "Python" },
  { value: "ruby", label: "Ruby" },
  { value: "rust", label: "Rust" },
  { value: "sql", label: "SQL" },
  { value: "swift", label: "Swift" },
  { value: "typescript", label: "TypeScript" },
  { value: "xml", label: "XML" },
  { value: "yaml", label: "YAML" },
];

function CodeBlockTools({ editor }: { editor: LexicalEditor }): JSX.Element {
  const [codeKey, setCodeKey] = useState<NodeKey | null>(null);
  const [language, setLanguage] = useState("text");
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  const update = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      setCodeKey(null);
      setPosition(null);
      return;
    }

    const codeNode = $findMatchingParent(selection.anchor.getNode(), $isCodeNode);
    if (!$isCodeNode(codeNode)) {
      setCodeKey(null);
      setPosition(null);
      return;
    }

    const key = codeNode.getKey();
    setCodeKey(key);
    setLanguage(codeNode.getLanguage() || "text");

    const dom = editor.getElementByKey(key);
    if (!dom) {
      setPosition(null);
      return;
    }
    const rect = dom.getBoundingClientRect();
    // Anchor at the block's top-right; CSS translates the control left by its
    // own width so it tucks inside the corner.
    setPosition({
      top: rect.top + 6 + window.scrollY,
      left: rect.right - 6 + window.scrollX,
    });
  }, [editor]);

  useEffect(() => {
    const onScroll = () => editor.getEditorState().read(() => update());
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [editor, update]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => update());
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          update();
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor, update]);

  const onLanguageChange = useCallback(
    (value: string) => {
      if (!codeKey) {
        return;
      }
      editor.update(() => {
        const node = $getNodeByKey(codeKey);
        if ($isCodeNode(node)) {
          node.setLanguage(value);
        }
      });
      setLanguage(value);
    },
    [codeKey, editor],
  );

  const onCopy = useCallback(() => {
    if (!codeKey) {
      return;
    }
    let text = "";
    editor.getEditorState().read(() => {
      const node = $getNodeByKey(codeKey);
      if (node) {
        text = node.getTextContent();
      }
    });
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  }, [codeKey, editor]);

  if (!position || !codeKey) {
    return <div style={{ display: "none" }} />;
  }

  return (
    <div
      className="lexical-code-tools"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <select
        className="lexical-code-tools-select"
        value={language}
        onChange={(event) => onLanguageChange(event.target.value)}
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.value} value={lang.value}>
            {lang.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="lexical-code-tools-button"
        title={copied ? "Copied" : "Copy code"}
        aria-label="Copy code"
        onClick={onCopy}
      >
        <Copy size={14} />
      </button>
    </div>
  );
}

export default function CodeBlockToolsPlugin(): JSX.Element {
  const [editor] = useLexicalComposerContext();
  return createPortal(<CodeBlockTools editor={editor} />, document.body);
}
