
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { depoimentos } from "@/lib/depoimentos-data";

export function Depoimentos() {
  return (
    <section
      id="depoimentos"
      className="scroll-mt-[var(--header-height)] bg-muted/30 px-6 py-20"
    >
      <div className="mx-auto max-w-6xl">
        <h2 className="font-heading text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          O que nossos clientes dizem
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          Experiências compartilhadas com a Don Energy.
        </p>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {depoimentos.map((depoimento, index) => (
            <Card
              key={depoimento.nome}
              className={
                index === depoimentos.length - 1 ? "sm:col-span-2" : undefined
              }
            >
              <CardHeader>
                <CardTitle className="text-lg">{depoimento.nome}</CardTitle>

              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {depoimento.texto}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
