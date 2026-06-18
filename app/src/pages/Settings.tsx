import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
        <p className="text-muted-foreground">
          Dominio remitente, planes/precios y URL base de reservas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Disponible en una fase posterior</CardTitle>
          <CardDescription>
            Esta pantalla se conectará a la tabla <code>app_config</code> cuando
            lleguemos al outreach y a los pagos (Fases 5–6): email remitente,
            <code> plan_prices</code> y <code>booking_base_url</code>. Por ahora
            el panel funciona sin tocar nada aquí.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
