import { ReactNode } from "react";

interface CodeBlockProps {
  children: ReactNode;
}

export function CodeBlock({ children }: CodeBlockProps) {
  return (
    <pre className="text-xs font-mono p-4 bg-gray-100 dark:bg-gray-800 rounded-md overflow-auto border">
      <code className="text-gray-800 dark:text-gray-200">{children}</code>
    </pre>
  );
}