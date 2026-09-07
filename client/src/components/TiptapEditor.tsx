import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ResizableImage } from "./ResizableImage";
import Placeholder from "@tiptap/extension-placeholder";

interface TiptapEditorProps {
  value: string;
  onChange: (value: string) => void;
  onImageUpload?: (file: File) => Promise<{ src: string; imageId?: string }>;
}

function parseInitialContent(value: string) {
  if (!value.trim()) return { type: "doc", content: [{ type: "paragraph" }] };
  try {
    const parsed = JSON.parse(value);
    if (parsed?.type === "doc") return parsed;
  } catch {
    // Legacy plain-text posts remain editable.
  }
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: value }] }] };
}

export function TiptapEditor({ value, onChange, onImageUpload }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bold: false,
        italic: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
      }),
      Placeholder.configure({ placeholder: "게시글 내용을 작성하세요..." }),
      ResizableImage.configure({ inline: false, allowBase64: false, HTMLAttributes: { class: "tiptap-image" } }),
    ],
    content: parseInitialContent(value),
    editorProps: {
      attributes: {
        class: "tiptap-content prose prose-sm max-w-none min-h-[280px] px-4 py-3 focus:outline-none",
      },
      handleDrop: (_view, event) => {
        const files = Array.from(event.dataTransfer?.files || []).filter((file) => file.type.startsWith("image/"));
        if (!files.length || !onImageUpload || !editor) return false;
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
        void (async () => {
          for (const file of files) {
            const result = await onImageUpload(file);
            editor.chain().focus().setImage({ src: result.src, alt: result.imageId || file.name, imageId: result.imageId || null } as any).run();
          }
        })();
        return true;
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files || []).filter((file) => file.type.startsWith("image/"));
        if (!files.length || !onImageUpload || !editor) return false;
        event.preventDefault();
        void (async () => {
          for (const file of files) {
            const result = await onImageUpload(file);
            editor.chain().focus().setImage({ src: result.src, alt: result.imageId || file.name, imageId: result.imageId || null } as any).run();
          }
        })();
        return true;
      },
    },
    onUpdate: ({ editor: currentEditor }) => onChange(JSON.stringify(currentEditor.getJSON())),
  });

  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    if (value && value !== current) {
      editor.commands.setContent(parseInitialContent(value), { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return <div className="min-h-[280px] animate-pulse bg-gray-50 rounded-xl" />;

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
      <EditorContent editor={editor} />
    </div>
  );
}
