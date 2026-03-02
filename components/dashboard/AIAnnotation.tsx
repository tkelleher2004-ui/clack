"use client";

export interface AIAnnotationProps {
  text: string;
}

export function AIAnnotation({ text }: AIAnnotationProps) {
  return (
    <div className="flex items-start gap-2 mt-2 px-1">
      <span className="text-purple-400 text-xs mt-0.5">✦</span>
      <p className="text-xs text-zinc-500 italic leading-relaxed">{text}</p>
    </div>
  );
}
