import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 px-4 text-center">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">404</h1>
        <p className="text-muted-foreground">Esta página no existe.</p>
        <Link to="/" className={buttonVariants()}>
          Volver al panel
        </Link>
      </div>
    </div>
  );
}
