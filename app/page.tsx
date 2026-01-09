import CosmicPlayer from "@/components/comsic"; // Adjust path if needed

// THIS LINE FORCES DYNAMIC RENDERING (Server-Side)
// It changes the build output from ○ (Static) to λ (Dynamic)
export const dynamic = "force-dynamic";

export default function Page() {
  return <CosmicPlayer />;
}
