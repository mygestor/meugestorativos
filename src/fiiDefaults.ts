// Dados padrão de FIIs com preços e dividendos baseados em dados históricos
// Atualizar periodicamente quando conseguir acesso à API
export const FII_DEFAULTS: Record<string, { currentPrice: number; dividendPerShare: number }> = {
  // Fundos de Tijolos (Imóveis Comerciais)
  HGLG11: { currentPrice: 148.92, dividendPerShare: 1.1 },
  MXRH11: { currentPrice: 10.8, dividendPerShare: 0.1 },
  XPML11: { currentPrice: 106.87, dividendPerShare: 0.92 },
  PLAS11: { currentPrice: 126.2, dividendPerShare: 1.2 },
  VILG11: { currentPrice: 137.0, dividendPerShare: 1.1 },
  NEWL11: { currentPrice: 104.69, dividendPerShare: 0.95 },
  XPLG11: { currentPrice: 91.28, dividendPerShare: 0.82 },
  
  // Fundos de Papel (Logística)
  BTCI11: { currentPrice: 9.22, dividendPerShare: 0.1 },
  CPTS11: { currentPrice: 7.49, dividendPerShare: 0.09 },
  LOGR11: { currentPrice: 85.5, dividendPerShare: 0.85 },
  GARE11: { currentPrice: 8.12, dividendPerShare: 0.08 },
  GGRC11: { currentPrice: 9.92, dividendPerShare: 0.1 },
  MXRF11: { currentPrice: 9.73, dividendPerShare: 0.1 },
  VGHF11: { currentPrice: 5.92, dividendPerShare: 0.09 },
  
  // Fundos Híbridos
  RZTR11: { currentPrice: 88.09, dividendPerShare: 1.0 },
  KLBN11: { currentPrice: 19.1, dividendPerShare: 0.08 },
  KNRI11: { currentPrice: 156.0, dividendPerShare: 1.0 },
  KNCR11: { currentPrice: 108.5, dividendPerShare: 1.35 },
  
  // Fundos de Terras Agrícolas
  ALZR11: { currentPrice: 9.97, dividendPerShare: 0.08 },
  
  // Fundos Atrelados ao IPCA
  FIIP11: { currentPrice: 102.0, dividendPerShare: 0.72 },
  RBRR11: { currentPrice: 124.5, dividendPerShare: 1.15 },
  RBRP11: { currentPrice: 135.0, dividendPerShare: 1.25 },
  
  // Ações
  BBAS3: { currentPrice: 21.84, dividendPerShare: 0.35 },
  CMIG4: { currentPrice: 10.97, dividendPerShare: 0.08 },
};

export function getFIIDefault(ticker: string) {
  return FII_DEFAULTS[ticker.toUpperCase()];
}
