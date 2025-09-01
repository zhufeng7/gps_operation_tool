import { TutorialStep } from "./tutorial-step";
import { CodeBlock } from "./code-block";

export function FetchDataSteps() {
  return (
    <div className="flex flex-col gap-8">
      <TutorialStep title="Fetch data from Supabase">
        <p>
          To fetch data from Supabase, you can use the{" "}
          <code className="text-sm bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
            createClient
          </code>{" "}
          function to create a Supabase client, then use it to query your database.
        </p>
        <CodeBlock>
{`import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("your_table")
    .select("*");
  
  if (error) {
    console.error("Error:", error);
    return <div>Error loading data</div>;
  }

  return (
    <div>
      <h1>Data from Supabase:</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}`}
        </CodeBlock>
      </TutorialStep>
      
      <TutorialStep title="Set up your database tables">
        <p>
          Create tables in your Supabase database and set up Row Level Security (RLS) policies
          to control access to your data.
        </p>
      </TutorialStep>
    </div>
  );
}