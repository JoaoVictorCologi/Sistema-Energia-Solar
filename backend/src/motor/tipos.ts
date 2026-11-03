// Tipos de grandeza do motor. Dois Decimal teriam a mesma forma para o TypeScript; a marca de unidade
// impede, por exemplo, somar kWh com reais sem perceber. Use as funções abaixo para criar cada grandeza.
import { Decimal } from 'decimal.js';

declare const unidade: unique symbol;
type Grandeza<Unidade extends string> = Decimal & { readonly [unidade]: Unidade };

export type Kwh = Grandeza<'kWh'>;
export type Kwp = Grandeza<'kWp'>;
export type Reais = Grandeza<'R$'>;
export type ReaisPorKwh = Grandeza<'R$/kWh'>;
// 0,18 = 18%.
export type Fracao = Grandeza<'fração'>;

export const kwh = (valor: Decimal.Value): Kwh => new Decimal(valor) as Kwh;
export const kwp = (valor: Decimal.Value): Kwp => new Decimal(valor) as Kwp;
export const reais = (valor: Decimal.Value): Reais => new Decimal(valor) as Reais;
export const reaisPorKwh = (valor: Decimal.Value): ReaisPorKwh => new Decimal(valor) as ReaisPorKwh;
export const fracao = (valor: Decimal.Value): Fracao => new Decimal(valor) as Fracao;

export interface Alerta {
  codigo: string;
  mensagem: string;
}
