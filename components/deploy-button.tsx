import Link from "next/link";
import { Button } from "./ui/button";

export function DeployButton() {
  return (
    <Button size="sm" className="bg-green-700 hover:bg-green-800 text-white" asChild>
      <Link
        href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Fnext.js%2Ftree%2Fcanary%2Fexamples%2Fwith-supabase&project-name=supabase-nextjs&repository-name=supabase-nextjs&integration-ids=oac_jUduyjQgOyzev1fjrW83NYOv"
        target="_blank"
        rel="noopener noreferrer"
      >
        Deploy to Vercel
      </Link>
    </Button>
  );
}