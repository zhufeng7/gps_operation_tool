import { ReactNode } from "react";

interface TutorialStepProps {
  title: string;
  children: ReactNode;
}

export function TutorialStep({ title, children }: TutorialStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="text-sm text-muted-foreground space-y-4">
        {children}
      </div>
    </div>
  );
}