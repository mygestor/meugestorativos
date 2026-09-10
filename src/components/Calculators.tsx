import { useState, useMemo } from "react";
import { formatCurrency, formatPercent } from "../format";
import { Calculator, TrendingUp, Shield, PiggyBank } from "lucide-react";

type CalculatorType = "milhao" | "reserva" | "juros";

interface CalculatorInput {
  label: string;
  value: string;
  placeholder: string;
  suffix?: string;
}

export function Calculators() {
  const [activeCalc, setActiveCalc] = useState<CalculatorType>("milhao");
  const [inputs, setInputs] = useState<Record<CalculatorType, Record<string, string>>>({
    milhao: { valor: "", taxa: "", tempo: "" },
    reserva: { despesas: "", meses: "" },
    juros: { capital: "", taxa: "", tempo: "" },
  });

  function updateInput(calc: CalculatorType, key: string, value: string) {
    setInputs((prev) => ({
      ...prev,
      [calc]: { ...prev[calc], [key]: value },
    }));
  }

  function parseNum(v: string): number {
    return parseFloat(v.replace(",", ".")) || 0;
  }

  // Primeiro Milhão: FV = PMT × [((1+r)^n - 1) / r]
  const milhaoResult = useMemo(() => {
    const pmt = parseNum(inputs.milhao.valor);
    const r = parseNum(inputs.milhao.taxa) / 100 / 12;
    const n = parseNum(inputs.milhao.tempo) * 12;

    if (pmt <= 0 || r <= 0 || n <= 0) return null;

    const fv = pmt * ((Math.pow(1 + r, n) - 1) / r);
    const totalInvestido = pmt * n;
    const rendimento = fv - totalInvestido;

    return { fv, totalInvestido, rendimento };
  }, [inputs.milhao]);

  // Reserva de Emergência: Meta = Despesas × Meses
  const reservaResult = useMemo(() => {
    const despesas = parseNum(inputs.reserva.despesas);
    const meses = parseNum(inputs.reserva.meses);

    if (despesas <= 0 || meses <= 0) return null;

    const meta = despesas * meses;
    const porMes = meta / 12;

    return { meta, porMes, meses };
  }, [inputs.reserva]);

  // Juros Compostos: VF = VP × (1+r)^n
  const jurosResult = useMemo(() => {
    const vp = parseNum(inputs.juros.capital);
    const r = parseNum(inputs.juros.taxa) / 100 / 12;
    const n = parseNum(inputs.juros.tempo) * 12;

    if (vp <= 0 || r <= 0 || n <= 0) return null;

    const vf = vp * Math.pow(1 + r, n);
    const rendimento = vf - vp;

    // Monthly evolution for chart
    const monthlyData = [];
    for (let i = 0; i <= n; i++) {
      const value = vp * Math.pow(1 + r, i);
      monthlyData.push({ month: i, value });
    }

    return { vf, rendimento, monthlyData };
  }, [inputs.juros]);

  const calculators = [
    { id: "milhao" as CalculatorType, label: "Primeiro Milhão", icon: TrendingUp, color: "text-green-500" },
    { id: "reserva" as CalculatorType, label: "Reserva de Emergência", icon: Shield, color: "text-blue-500" },
    { id: "juros" as CalculatorType, label: "Juros Compostos", icon: PiggyBank, color: "text-purple-500" },
  ];

  return (
    <div className="space-y-4">
      {/* Calculator Selector */}
      <div className="grid grid-cols-3 gap-2">
        {calculators.map((calc) => (
          <button
            key={calc.id}
            onClick={() => setActiveCalc(calc.id)}
            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
              activeCalc === calc.id
                ? "bg-card border-primary shadow-sm"
                : "bg-surface/50 border-border hover:bg-card"
            }`}
          >
            <calc.icon className={`size-6 ${activeCalc === calc.id ? calc.color : "text-muted"}`} />
            <span className={`text-xs font-medium ${activeCalc === calc.id ? "text-foreground" : "text-muted"}`}>
              {calc.label}
            </span>
          </button>
        ))}
      </div>

      {/* Primeiro Milhão */}
      {activeCalc === "milhao" && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="size-5 text-green-500" />
            <h3 className="font-semibold text-sm">Quanto tempo para R$ 1.000.000?</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted font-medium">Aporte Mensal (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                value={inputs.milhao.valor}
                onChange={(e) => updateInput("milhao", "valor", e.target.value)}
                placeholder="1.000"
                className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted font-medium">Taxa ao Mês (%)</label>
              <input
                type="text"
                inputMode="decimal"
                value={inputs.milhao.taxa}
                onChange={(e) => updateInput("milhao", "taxa", e.target.value)}
                placeholder="1,0"
                className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted font-medium">Tempo (anos)</label>
              <input
                type="text"
                inputMode="decimal"
                value={inputs.milhao.tempo}
                onChange={(e) => updateInput("milhao", "tempo", e.target.value)}
                placeholder="20"
                className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {milhaoResult && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-surface/50 rounded-xl p-3 text-center">
                <p className="text-xs text-muted mb-1">Patrimônio Final</p>
                <p className="text-lg font-bold text-green-500 tabular">{formatCurrency(milhaoResult.fv)}</p>
              </div>
              <div className="bg-surface/50 rounded-xl p-3 text-center">
                <p className="text-xs text-muted mb-1">Total Investido</p>
                <p className="text-lg font-bold tabular">{formatCurrency(milhaoResult.totalInvestido)}</p>
              </div>
              <div className="bg-surface/50 rounded-xl p-3 text-center">
                <p className="text-xs text-muted mb-1">Rendimento</p>
                <p className="text-lg font-bold text-emerald-500 tabular">{formatCurrency(milhaoResult.rendimento)}</p>
              </div>
            </div>
          )}

          <p className="text-xs text-muted">
            Considerando juros compostos mensais com aportes regulares.
          </p>
        </div>
      )}

      {/* Reserva de Emergência */}
      {activeCalc === "reserva" && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="size-5 text-blue-500" />
            <h3 className="font-semibold text-sm">Quanto guardar para a reserva?</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted font-medium">Despesas Mensais (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                value={inputs.reserva.despesas}
                onChange={(e) => updateInput("reserva", "despesas", e.target.value)}
                placeholder="3.000"
                className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted font-medium">Meses de Cobertura</label>
              <input
                type="text"
                inputMode="decimal"
                value={inputs.reserva.meses}
                onChange={(e) => updateInput("reserva", "meses", e.target.value)}
                placeholder="6"
                className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {reservaResult && (
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-surface/50 rounded-xl p-3 text-center">
                <p className="text-xs text-muted mb-1">Meta Total</p>
                <p className="text-lg font-bold text-blue-500 tabular">{formatCurrency(reservaResult.meta)}</p>
              </div>
              <div className="bg-surface/50 rounded-xl p-3 text-center">
                <p className="text-xs text-muted mb-1">Aporte Mensal (12 meses)</p>
                <p className="text-lg font-bold tabular">{formatCurrency(reservaResult.porMes)}</p>
              </div>
            </div>
          )}

          <div className="bg-surface/50 rounded-xl p-3">
            <p className="text-xs text-muted">
              <strong>Recomendação:</strong> Ter de 3 a 6 meses de despesas guardadas em investimentos de alta liquidez (ex: Tesouro Selic, CDB diário).
            </p>
          </div>
        </div>
      )}

      {/* Juros Compostos */}
      {activeCalc === "juros" && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <PiggyBank className="size-5 text-purple-500" />
            <h3 className="font-semibold text-sm">Simulador de Juros Compostos</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted font-medium">Capital Inicial (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                value={inputs.juros.capital}
                onChange={(e) => updateInput("juros", "capital", e.target.value)}
                placeholder="10.000"
                className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted font-medium">Taxa ao Mês (%)</label>
              <input
                type="text"
                inputMode="decimal"
                value={inputs.juros.taxa}
                onChange={(e) => updateInput("juros", "taxa", e.target.value)}
                placeholder="1,0"
                className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted font-medium">Tempo (anos)</label>
              <input
                type="text"
                inputMode="decimal"
                value={inputs.juros.tempo}
                onChange={(e) => updateInput("juros", "tempo", e.target.value)}
                placeholder="10"
                className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {jurosResult && (
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-surface/50 rounded-xl p-3 text-center">
                <p className="text-xs text-muted mb-1">Valor Final</p>
                <p className="text-lg font-bold text-purple-500 tabular">{formatCurrency(jurosResult.vf)}</p>
              </div>
              <div className="bg-surface/50 rounded-xl p-3 text-center">
                <p className="text-xs text-muted mb-1">Rendimento</p>
                <p className="text-lg font-bold text-emerald-500 tabular">{formatCurrency(jurosResult.rendimento)}</p>
              </div>
            </div>
          )}

          <p className="text-xs text-muted">
            O poder dos juros compostos: o rendimento cresce exponencialmente ao longo do tempo.
          </p>
        </div>
      )}
    </div>
  );
}