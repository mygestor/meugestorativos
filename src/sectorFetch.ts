// Busca setor/segmento automaticamente via Yahoo Finance
const SECTOR_CACHE = new Map<string, string>();

const KNOWN_SECTORS: Record<string, string> = {
  // FIIs - Logística
  HGLG11: "LOGÍSTICA", XPLG11: "LOGÍSTICA", GGRC11: "LOGÍSTICA", LOGR11: "LOGÍSTICA",
  GARE11: "LOGÍSTICA", TRXF11: "LOGÍSTICA", ARXF11: "LOGÍSTICA",
  // FIIs - Papel
  MXRF11: "PAPEL", CPTS11: "PAPEL", BTCI11: "PAPEL", KNCR11: "PAPEL",
  VGHF11: "PAPEL", RBRF11: "PAPEL", RBRR11: "PAPEL", RBRP11: "PAPEL",
  // FIIs - Tijolo
  XPML11: "SHOPPING", KNRI11: "HÍBRIDO", NEWL11: "HÍBRIDO", PLAS11: "HÍBRIDO",
  VILG11: "HÍBRIDO", MXRH11: "HÍBRIDO", FIIP11: "HÍBRIDO",
  // FIIs - Terras
  ALZR11: "TERRAS AGRÍCOLAS", RZTR11: "TERRAS AGRÍCOLAS",
  // FIIs - Hibridos
  HFOF11: "HÍBRIDO", PVBI11: "HÍBRIDO",
  // Ações - Bancos
  BBAS3: "BANCO", BBDC3: "BANCO", BBDC4: "BANCO", ITUB3: "BANCO", ITUB4: "BANCO",
  SANB11: "BANCO", BRSR6: "BANCO", BPAC11: "BANCO", BPAC3: "BANCO",
  // Ações - Energia
  ELET3: "ENERGIA", ELET6: "ENERGIA", TAEE11: "ENERGIA", CMIG4: "ENERGIA",
  CPFE3: "ENERGIA", ENBR3: "ENERGIA", ENGI11: "ENERGIA", EQTL3: "ENERGIA",
  // Ações - Mineração/Petróleo
  VALE3: "MINERAÇÃO", PETR3: "PETRÓLEO", PETR4: "PETRÓLEO", PRIO3: "PETRÓLEO",
  // Ações - Varejo
  MGLU3: "VAREJO", LREN3: "VAREJO", AMER3: "VAREJO", SARE3: "VAREJO",
  // Ações - Alimentos
  ABEV3: "ALIMENTOS", BEEF3: "ALIMENTOS", JBSS3: "ALIMENTOS", BRFS3: "ALIMENTOS",
  CSAN3: "ALIMENTOS",
  // Ações - Siderurgia
  GGBR4: "SIDERURGIA", CSNA3: "SIDERURGIA", USIM3: "SIDERURGIA", USIM5: "SIDERURGIA",
  // Ações - Telecom
  VIVT3: "TELECOM", TIMP3: "TELECOM",
  // Ações - Tecnologia
  TOTS3: "TECNOLOGIA", WEGE3: "TECNOLOGIA", LWSA3: "TECNOLOGIA",
  // Ações - Saúde
  HAPV3: "SAÚDE", RDOR3: "SAÚDE", FLRY3: "SAÚDE",
  // Ações - Construção
  MRVE3: "CONSTRUÇÃO", TEND3: "CONSTRUÇÃO", CYRE3: "CONSTRUÇÃO",
  // Ações - Transporte
  GOLL4: "TRANSPORTE", AZUL4: "TRANSPORTE", RENT3: "TRANSPORTE",
  // Ações - Utilidades
  SOJA3: "UTILIDADES", CORR4: "UTILIDADES",
  // Ações - Defesa/Indústria
  TASA4: "DEFESA",
  // Ações - Financeiro
  BIDI4: "FINANCEIRO", CIEL3: "PAGAMENTOS", BBSE3: "SEGUROS",
  // Ações - Papel e Celulose
  KLBN11: "PAPEL E CELULOSE",
  // Ações - Energia
  CPLE3: "ENERGIA", TAEE3: "TRANSMISSÃO",
  // Ações - Saneamento
  SAPR4: "SANEAMENTO", CSMG3: "SANEAMENTO",
  // Ações - Diversos
  CASH3: "TECNOLOGIA", CXSE3: "FINANCEIRO", AURE3: "ENERGIA",
  // ETFs
  BOVA11: "ETF", IVVB11: "ETF", SMAL11: "ETF", HASH11: "ETF",
};

export async function fetchSector(ticker: string): Promise<string> {
  const u = ticker.toUpperCase();
  if (SECTOR_CACHE.has(u)) return SECTOR_CACHE.get(u)!;
  if (KNOWN_SECTORS[u]) {
    SECTOR_CACHE.set(u, KNOWN_SECTORS[u]);
    return KNOWN_SECTORS[u];
  }

  try {
    const yahooTicker = `${u}.SA`;
    const proxies = [
      `https://corsproxy.io/?${encodeURIComponent(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${yahooTicker}?modules=assetProfile`)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${yahooTicker}?modules=assetProfile`)}`,
    ];

    for (const url of proxies) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        const sector = data?.quoteSummary?.result?.[0]?.assetProfile?.sector;
        const industry = data?.quoteSummary?.result?.[0]?.assetProfile?.industry;
        const result = sector || industry || "";
        if (result) {
          SECTOR_CACHE.set(u, result);
          return result;
        }
      } catch { continue; }
    }
  } catch {}

  const fallback = KNOWN_SECTORS[u] || "";
  SECTOR_CACHE.set(u, fallback);
  return fallback;
}

export function getKnownSector(ticker: string): string {
  return KNOWN_SECTORS[ticker.toUpperCase()] || "";
}
