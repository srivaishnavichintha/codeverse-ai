import { useRef, useState, useCallback, useEffect } from "react";
import "./CodeEditor.css";

const INDENT = "  "; // 2 spaces

const KEYWORDS = {
  cpp: /\b(int|long|bool|void|return|class|public|private|vector|string|if|else|for|while|do|break|continue|auto|nullptr|true|false|const|struct|using|namespace|std|include|define|template|typename)\b/g,
  java: /\b(int|long|boolean|void|return|class|public|private|static|final|new|null|true|false|if|else|for|while|do|break|continue|import|package|extends|implements|this|super|interface)\b/g,
  python: /\b(def|class|return|if|elif|else|for|while|in|not|and|or|True|False|None|import|from|as|with|lambda|pass|break|continue|try|except|finally|raise|yield|global|nonlocal|self)\b/g,
  javascript: /\b(const|let|var|function|return|class|new|null|undefined|true|false|if|else|for|while|do|break|continue|import|export|default|async|await|try|catch|finally|throw|typeof|instanceof|of|in|this|super|extends)\b/g,
};

function highlightCode(code, lang) {
  if (!code) return "";
  const escaped = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Strings
  let h = escaped.replace(
    /(&#39;[^&#39;]*&#39;|&quot;[^&quot;]*&quot;|`[^`]*`|'[^']*'|"[^"]*")/g,
    '<span class="cv-ce-str">$1</span>'
  );

  // Comments
  h = h.replace(/(\/\/[^\n]*|#[^\n]*)/g, '<span class="cv-ce-comment">$1</span>');

  // Keywords (only if not already inside a span)
  const kw = KEYWORDS[lang] || KEYWORDS.javascript;
  h = h.replace(
    new RegExp(`(?<!<[^>]*)\\b(${kw.source.slice(2, -2)})\\b`, "g"),
    '<span class="cv-ce-kw">$1</span>'
  );

  // Numbers
  h = h.replace(/\b(\d+\.?\d*)\b/g, '<span class="cv-ce-num">$1</span>');

  return h;
}

export default function CodeEditor({ value = "", onChange, language = "cpp", fontSize = 14 }) {
  const textareaRef = useRef(null);
  const highlightRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Sync scroll between textarea and highlight layer
  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
    setScrollLeft(e.target.scrollLeft);
  }, []);

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollTop = scrollTop;
      highlightRef.current.scrollLeft = scrollLeft;
    }
  }, [scrollTop, scrollLeft]);

  // Smart tab / indent handling
  const handleKeyDown = useCallback(
    (e) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const { selectionStart: s, selectionEnd: end, value: v } = ta;

      // Tab → insert spaces
      if (e.key === "Tab") {
        e.preventDefault();
        const newVal = v.slice(0, s) + INDENT + v.slice(end);
        onChange?.(newVal);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = s + INDENT.length;
        });
        return;
      }

      // Enter → auto-indent
      if (e.key === "Enter") {
        const lineStart = v.lastIndexOf("\n", s - 1) + 1;
        const line = v.slice(lineStart, s);
        const indent = line.match(/^(\s*)/)?.[1] ?? "";
        const extra = /[{(\[:]$/.test(line.trimEnd()) ? INDENT : "";
        e.preventDefault();
        const newVal = v.slice(0, s) + "\n" + indent + extra + v.slice(end);
        onChange?.(newVal);
        const cursor = s + 1 + indent.length + extra.length;
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = cursor;
        });
        return;
      }

      // Auto-close brackets
      const pairs = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'" };
      if (pairs[e.key] && s === end) {
        e.preventDefault();
        const close = pairs[e.key];
        const newVal = v.slice(0, s) + e.key + close + v.slice(end);
        onChange?.(newVal);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = s + 1;
        });
      }
    },
    [onChange]
  );

  const lines = (value || "").split("\n");
  const lineCount = Math.max(lines.length, 1);

  return (
    <div className="cv-ce-root" style={{ fontSize }}>
      {/* Line numbers */}
      <div
        className="cv-ce-gutter"
        style={{ fontSize }}
        aria-hidden="true"
      >
        <div
          className="cv-ce-gutter-inner"
          style={{ transform: `translateY(-${scrollTop}px)` }}
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="cv-ce-line-num">
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Editor body */}
      <div className="cv-ce-body">
        {/* Syntax highlight layer (behind textarea) */}
        <pre
          ref={highlightRef}
          className="cv-ce-highlight"
          aria-hidden="true"
          style={{ fontSize }}
          dangerouslySetInnerHTML={{
            __html: highlightCode(value, language) + "\n",
          }}
        />

        {/* Actual textarea (transparent text) */}
        <textarea
          ref={textareaRef}
          className="cv-ce-textarea"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          style={{ fontSize }}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
        />
      </div>
    </div>
  );
}
