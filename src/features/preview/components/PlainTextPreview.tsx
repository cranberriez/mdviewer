interface PlainTextPreviewProps {
  content: string;
}

export function PlainTextPreview({ content }: PlainTextPreviewProps) {
  return <pre className="plain">{content}</pre>;
}
