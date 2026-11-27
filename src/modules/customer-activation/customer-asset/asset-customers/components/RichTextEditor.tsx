"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";

import "react-quill-new/dist/quill.snow.css";

import styles from "./rich-text-editor.module.css";

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    ariaLabel?: string;
    className?: string;
}

const MODULES = {
    toolbar: [
        ["bold", "italic", "underline", "strike"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link"],
        ["clean"],
    ],
};

/**
 * Quill rich-text editor via `react-quill-new` (the maintained
 * `react-quill` fork, React 19 compatible). No image/video/code-block
 * in the toolbar — XSS/asset vectors.
 *
 * Client-only: Quill touches `document` at module scope, so the wrapper
 * loads with `ssr: false` and the browser gets a fallback while the
 * chunk resolves. The snow stylesheet is imported statically — CSS is
 * extracted by the bundler and never executed, so it carries no DOM risk.
 *
 * `react-quill-new` renders the same `.ql-toolbar` / `.ql-container` /
 * `.ql-editor` DOM as direct Quill, so the dark-mode overrides in
 * `rich-text-editor.module.css` apply unchanged.
 */
const QuillEditor = dynamic(() => import("react-quill-new").then((module) => module.default), {
    ssr: false,
    loading: () => <p className="p-3 text-sm text-muted-foreground">Loading editor…</p>,
});

export function RichTextEditor({
    value,
    onChange,
    placeholder,
    ariaLabel,
    className,
}: RichTextEditorProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // The editor mounts asynchronously after the dynamic chunk resolves,
    // so a mutation observer waits for `.ql-editor` to appear, labels it,
    // then disconnects — it never watches the editor for the whole session.
    useEffect(() => {
        const container = containerRef.current;
        if (container === null) return;

        const applyAria = (): boolean => {
            const editingArea = container.querySelector<HTMLElement>(".ql-editor");
            if (editingArea === null) return false;
            editingArea.setAttribute("role", "textbox");
            if (ariaLabel === undefined) {
                editingArea.removeAttribute("aria-label");
            } else {
                editingArea.setAttribute("aria-label", ariaLabel);
            }
            return true;
        };

        if (applyAria()) return;

        const observer = new MutationObserver(() => {
            if (applyAria()) observer.disconnect();
        });
        observer.observe(container, { childList: true, subtree: true });

        return () => observer.disconnect();
    }, [ariaLabel]);

    return (
        <div
            ref={containerRef}
            className={`${styles.host} min-h-[140px] rounded-lg border ${className ?? ""}`.trimEnd()}
        >
            <QuillEditor
                theme="snow"
                value={value}
                onChange={(html, _delta, source) => {
                    if (source === "user") onChange(html);
                }}
                placeholder={placeholder}
                modules={MODULES}
            />
        </div>
    );
}
