import { useEffect, useRef } from "react";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import Image from "@tiptap/extension-image";

function ResizableImageView({ node, updateAttributes, selected, deleteNode }: any) {
  const start = useRef<{ x: number; width: number } | null>(null);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!start.current) return;
      const nextWidth = Math.max(80, Math.min(1200, start.current.width + event.clientX - start.current.x));
      updateAttributes({ width: Math.round(nextWidth) });
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!start.current) return;
      event.preventDefault();
      const touch = event.touches[0];
      const nextWidth = Math.max(80, Math.min(1200, start.current.width + touch.clientX - start.current.x));
      updateAttributes({ width: Math.round(nextWidth) });
    };
    const onUp = () => { start.current = null; document.body.style.cursor = ""; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); document.removeEventListener("touchmove", onTouchMove); document.removeEventListener("touchend", onUp); };
  }, [updateAttributes]);

  const beginResize = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    start.current = { x: event.clientX, width: node.attrs.width || 480 };
    document.body.style.cursor = "nwse-resize";
  };

  const beginTouchResize = (event: React.TouchEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const touch = event.touches[0];
    start.current = { x: touch.clientX, width: node.attrs.width || 480 };
    document.body.style.cursor = "ew-resize";
  };

  const align = node.attrs.align || "center";
  return (
    <NodeViewWrapper className="tiptap-image-node" style={{ textAlign: align }}>
      <span className={`relative inline-block ${selected ? "ring-2 ring-primary-500" : ""}`}>
        <img src={node.attrs.src} alt={node.attrs.alt || "본문 이미지"} style={{ width: node.attrs.width ? `${node.attrs.width}px` : undefined, maxWidth: "100%", height: "auto" }} draggable="false" onDragStart={(event) => event.preventDefault()} />
        {selected && <>
          <span className="absolute -right-3 -bottom-3 w-6 h-6 rounded-full bg-primary-600 border-2 border-white cursor-nwse-resize touch-none" onMouseDown={beginResize} onTouchStart={beginTouchResize} />
          <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex gap-1 bg-white shadow rounded-lg p-1">
            {(["left", "center", "right"] as const).map((value) => <button key={value} type="button" className={`px-2 py-0.5 text-xs rounded ${align === value ? "bg-primary-100" : "hover:bg-gray-100"}`} onMouseDown={(event) => { event.preventDefault(); updateAttributes({ align: value }); }}>{value === "left" ? "좌" : value === "center" ? "중" : "우"}</button>)}
            <button type="button" className="inline-flex items-center justify-center whitespace-nowrap min-w-[3rem] px-2 py-0.5 text-xs rounded text-red-600 hover:bg-red-50" onMouseDown={(event) => { event.preventDefault(); deleteNode(); }}>삭제</button>
          </div>
        </>}
      </span>
    </NodeViewWrapper>
  );
}

export const ResizableImage = Image.extend({
  draggable: true,
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null },
      align: { default: "center" },
      imageId: { default: null },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});
