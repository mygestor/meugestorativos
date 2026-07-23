// Dados padrão de FIIs com preços e dividendos baseados em dados históricos
// Atualizar periodicamente quando conseguir acesso à API
export const FII_DEFAULTS: Record<string, { currentPrice: number; dividendPerShare: number }> = {
  // Fundos de Tijolos (Imóveis Comerciais)
  HGLG11: { currentPrice: 148.46, dividendPerShare: 1.10 },
  MXRH11: { currentPrice: 10.8, dividendPerShare: 0.1 },
  XPML11: { currentPrice: 104.49, dividendPerShare: 0.92 },
  PLAS11: { currentPrice: 126.2, dividendPerShare: 1.2 },
  VILG11: { currentPrice: 137.0, dividendPerShare: 1.1 },
  NEWL11: { currentPrice: 103.92, dividendPerShare: 0.99 },
  XPLG11: { currentPrice: 90.95, dividendPerShare: 0.82 },
  
  // Fundos de Papel (Logística)
  BTCI11: { currentPrice: 9.11, dividendPerShare: 0.10 },
  CPTS11: { currentPrice: 7.45, dividendPerShare: 0.09 },
  LOGR11: { currentPrice: 85.5, dividendPerShare: 0.85 },
  GARE11: { currentPrice: 8.15, dividendPerShare: 0.08 },
  GGRC11: { currentPrice: 9.87, dividendPerShare: 0.10 },
  MXRF11: { currentPrice: 9.67, dividendPerShare: 0.10 },
  VGHF11: { currentPrice: 5.88, dividendPerShare: 0.07 },
  
  // Fundos Híbridos
  RZTR11: { currentPrice: 87.10, dividendPerShare: 0.99 },
  KLBN11: { currentPrice: 19.1, dividendPerShare: 0.08 },
  KNRI11: { currentPrice: 156.43, dividendPerShare: 1.08 },
  KNCR11: { currentPrice: 108.00, dividendPerShare: 1.20 },
  
  // Fundos de Terras Agrícolas
  ALZR11: { currentPrice: 9.90, dividendPerShare: 0.08 },
  
  // Fundos Atrelados ao IPCA
  FIIP11: { currentPrice: 102.0, dividendPerShare: 0.72 },
  RBRR11: { currentPrice: 124.5, dividendPerShare: 1.15 },
  RBRP11: { currentPrice: 135.0, dividendPerShare: 1.25 },
  
  // Ações
  BBAS3: { currentPrice: 20.43, dividendPerShare: 0.24 },
  CMIG4: { currentPrice: 11.00, dividendPerShare: 0.27 },
};

export function getFIIDefault(ticker: string) {
  return FII_DEFAULTS[ticker.toUpperCase()];
}
